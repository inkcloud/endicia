"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const xmlbuilder = __importStar(require("xmlbuilder"));
const xml2js_1 = require("xml2js");
const request_promise_1 = __importDefault(require("request-promise"));
const shortid_1 = __importDefault(require("shortid"));
var EndiciaEndpoints;
(function (EndiciaEndpoints) {
    EndiciaEndpoints["test"] = "https://elstestserver.endicia.com/LabelService/EwsLabelService.asmx";
    EndiciaEndpoints["live"] = "https://labelserver.endicia.com/LabelService/EwsLabelService.asmx";
})(EndiciaEndpoints = exports.EndiciaEndpoints || (exports.EndiciaEndpoints = {}));
var EndiciaMailClass;
(function (EndiciaMailClass) {
    EndiciaMailClass["PriorityExpress"] = "PriorityExpress";
    EndiciaMailClass["First"] = "First";
    EndiciaMailClass["LibraryMail"] = "LibraryMail";
    EndiciaMailClass["MediaMail"] = "MediaMail";
    EndiciaMailClass["ParcelSelect"] = "ParcelSelect";
    EndiciaMailClass["RetailGround"] = "RetailGround";
    EndiciaMailClass["Priority"] = "Priority";
    EndiciaMailClass["PriorityMailExpressInternational"] = "PriorityMailExpressInternational";
    EndiciaMailClass["FirstClassMailInternational"] = "FirstClassMailInternational";
    EndiciaMailClass["FirstClassPackageInternationalService"] = "FirstClassPackageInternationalService";
    EndiciaMailClass["PriorityMailInternational"] = "PriorityMailInternational";
})(EndiciaMailClass = exports.EndiciaMailClass || (exports.EndiciaMailClass = {}));
class Endicia {
    constructor(options) {
        const baseUrl = options.mode === 'live' ? EndiciaEndpoints.live : EndiciaEndpoints.test;
        this.options = options;
        this.request = request_promise_1.default.defaults({ baseUrl });
        this.accountId = this.options.accountId;
        this.passPhrase = this.options.passPhrase;
        this.mode = this.options.mode;
        this.requesterId = this.options.requesterId;
    }
    getBase(root, credsInCertifiedIntermediary = true) {
        const base = xmlbuilder.create(root)
            .att('TokenRequested', 'false')
            .ele('RequesterID', this.requesterId).up()
            .ele('RequestID', shortid_1.default.generate()).up();
        if (credsInCertifiedIntermediary) {
            base.ele('CertifiedIntermediary')
                .ele('AccountID', this.accountId).up()
                .ele('PassPhrase', this.passPhrase).up();
        }
        else {
            base.ele('AccountID', this.accountId).up()
                .ele('PassPhrase', this.passPhrase).up();
        }
        return base;
    }
    buyPostage(amount) {
        return __awaiter(this, void 0, void 0, function* () {
            const xml = this.getBase('RecreditRequest')
                .ele('RecreditAmount', amount)
                .end({ pretty: true });
            const response = this.request('/BuyPostageXML?recreditRequestXML=' + xml);
            return new Promise((resolve, reject) => {
                xml2js_1.parseString(response, { explicitArray: false }, (err, data) => {
                    if (err) {
                        reject(err);
                    }
                    else {
                        resolve(data);
                    }
                });
            });
        });
    }
    rateSingle(data) {
        return __awaiter(this, void 0, void 0, function* () {
            const xml = this.getBase('PostageRateRequest')
                .ele('MailClass', data.mailClass).up()
                .ele('WeightOz', data.weight).up()
                .ele('MailpieceShape', data.mailPieceShape).up()
                .ele('FromPostalCode', data.shipFromPostalCode).up()
                .ele('ToPostalCode', data.shipToPostalCode).up()
                .end({ pretty: true });
            const response = yield this.request('/CalculatePostageRateXML?postageRateRequestXML=' + xml);
            return new Promise((resolve, reject) => {
                xml2js_1.parseString(response, { explicitArray: false }, (err, data) => {
                    if (data && data.PostageRateResponse.Postage) {
                        const rate = data.PostageRateResponse.Postage.Rate;
                        return resolve(rate);
                    }
                });
            });
        });
    }
    getPostageLabel(data) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!data.shipFrom && (!this.options.label || !this.options.label.shipFrom)) {
                throw Error('Ship From must be included');
            }
            const shipFrom = data.shipFrom || this.options.label.shipFrom;
            const imageRotation = data.imageRotation || 'NONE';
            const labelSize = data.labelSize || '4x6';
            const xml = this.getBase('LabelRequest', false)
                .att('Test', this.mode !== 'live' ? 'YES' : 'NO')
                .att('LabelType', 'Default')
                .att('LabelSubtype', 'None')
                .att('LabelSize', labelSize)
                .att('ImageFormat', 'PNG')
                .att('ImageResolution', '300')
                .att('ImageRotation', imageRotation)
                .ele('MailClass', data.mailClass).up()
                .ele('WeightOz', data.weight).up()
                .ele('MailpieceShape', data.mailPieceShape).up()
                .ele('ShowReturnAddress', data.showReturnAddress || 'TRUE').up()
                .ele('PartnerTransactionID', data.orderReference || shortid_1.default.generate()).up()
                .ele('PartnerCustomerID', data.customerReference || shortid_1.default.generate()).up()
                .ele('FromCompany', shipFrom.name).up()
                // .ele('FromPhone', shipFrom.phone).up()
                .ele('ReturnAddress1', shipFrom.address1).up()
                .ele('FromCity', shipFrom.city).up()
                .ele('FromState', shipFrom.stateProvince).up()
                .ele('FromPostalCode', shipFrom.postalCode).up()
                .ele('ToName', data.shipTo.name).up()
                .ele('ToAddress1', data.shipTo.address1).up()
                .ele('ToAddress2', data.shipTo.address2).up()
                .ele('ToCity', data.shipTo.city).up()
                .ele('ToState', data.shipTo.stateProvince).up()
                .ele('ToPostalCode', data.shipTo.postalCode).up()
                .end({ pretty: true });
            const response = yield this.request('/GetPostageLabelXML?labelRequestXML=' + xml);
            return new Promise((resolve, reject) => {
                xml2js_1.parseString(response, { explicitArray: false }, (err, data) => {
                    if (data && data.LabelRequestResponse) {
                        const lr = data.LabelRequestResponse;
                        if (lr.ErrorMessage) {
                            return reject(new Error(lr.ErrorMessage));
                        }
                        return resolve({
                            base64LabelImage: lr.Base64LabelImage,
                            trackingNumber: lr.TrackingNumber,
                            postageAmount: lr.FinalPostage,
                        });
                    }
                });
            });
        });
    }
    changePassword(newPassPhrase) {
        return __awaiter(this, void 0, void 0, function* () {
            const xml = this.getBase('ChangePassPhraseRequest')
                .ele('NewPassPhrase', newPassPhrase)
                .end({ pretty: true });
            const response = this.request('/ChangePassPhraseXML?changePassPhraseRequestXML=' + xml);
            return new Promise((resolve, reject) => {
                xml2js_1.parseString(response, { explicitArray: false }, (err, data) => {
                    if (err) {
                        reject(err);
                    }
                    else {
                        resolve(data);
                    }
                });
            });
        });
    }
}
exports.default = Endicia;
