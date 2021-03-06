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
function removeIllegalSymbols(str) {
    return String(str).trim().replace(/#/g, '').replace(/’/g, '`');
}
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
            const response = yield this.request('/BuyPostageXML?recreditRequestXML=' + xml);
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
            const { isInternational } = data;
            const xml = this.getBase('LabelRequest', false)
                .att('Test', this.mode !== 'live' ? 'YES' : 'NO')
                .att('LabelType', data.labelType || isInternational ? 'International' : 'Default')
                .att('LabelSubtype', data.labelSubtype || isInternational ? 'Integrated' : 'None')
                .att('LabelSize', data.labelSize || '4x6')
                .att('ImageFormat', data.fileType || 'EPL2')
                .att('ImageResolution', data.imageResolution || 203)
                .att('ImageRotation', data.imageRotation || 'NONE')
                .ele('ReplyPostage', Boolean(data.replyPostage)).up()
                .ele('MailClass', data.mailClass || isInternational ?
                data.weight >= 64 ? 'PriorityMailInternational' : 'FirstClassMailInternational' :
                data.weight >= 16 ? 'Priority' : 'First').up()
                .ele('WeightOz', data.weight).up()
                .ele('MailpieceShape', data.mailPieceShape || 'Parcel').up()
                .ele('ShowReturnAddress', data.showReturnAddress || 'TRUE').up()
                .ele('PartnerTransactionID', data.orderReference || shortid_1.default.generate()).up()
                .ele('PartnerCustomerID', data.customerReference || shortid_1.default.generate()).up()
                .ele('FromCompany', shipFrom.name).up()
                .ele('FromPhone', shipFrom.phone).up()
                .ele('ReturnAddress1', shipFrom.address1).up()
                .ele('FromCity', shipFrom.city).up()
                .ele('FromState', shipFrom.stateProvince).up()
                .ele('FromPostalCode', shipFrom.postalCode).up()
                .ele('ToName', removeIllegalSymbols(data.shipTo.name)).up()
                .ele('ToAddress1', removeIllegalSymbols(data.shipTo.address1)).up()
                .ele('ToAddress2', removeIllegalSymbols(data.shipTo.address2)).up()
                .ele('ToCity', removeIllegalSymbols(data.shipTo.city)).up()
                .ele('ToState', removeIllegalSymbols(data.shipTo.stateProvince)).up()
                .ele('ToPostalCode', !isInternational ? removeIllegalSymbols(data.shipTo.postalCode).split('-')[0] : removeIllegalSymbols(data.shipTo.postalCode)).up();
            if (!isInternational && removeIllegalSymbols(data.shipTo.postalCode).split('-')[1]) {
                xml.ele('ToZIP4', removeIllegalSymbols(data.shipTo.postalCode).split('-')[1]).up();
            }
            if (isInternational && Array.isArray(data.orderItems)) {
                const customsItems = xml
                    .ele('ToCountryCode', data.shipTo.countryCode).up()
                    .ele('CustomsInfo')
                    .ele('ContentsType', 'Merchandise').up()
                    .ele('CustomsItems');
                for (const item of data.orderItems) {
                    customsItems
                        .ele('CustomsItem')
                        .ele('Description', item.description).up()
                        .ele('Quantity', item.quantity).up()
                        .ele('Weight', item.weight).up()
                        .ele('Value', item.itemPrice).up();
                }
                xml.end({ pretty: true });
            }
            else {
                xml
                    .ele('ToCountryCode', 'US').up()
                    .end({ pretty: true });
            }
            const response = yield this.request({
                body: `labelRequestXML=${xml}`,
                method: 'POST',
                uri: '/GetPostageLabelXML?labelRequestXML',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
            });
            return new Promise((resolve, reject) => {
                xml2js_1.parseString(response, { explicitArray: false }, (err, data) => {
                    if (data && data.LabelRequestResponse) {
                        const lr = data.LabelRequestResponse;
                        if (lr.ErrorMessage) {
                            return reject(new Error(lr.ErrorMessage));
                        }
                        let base64LabelImage = lr.Base64LabelImage;
                        if (isInternational) {
                            base64LabelImage = lr.Label.Image
                                .sort((a, b) => {
                                if (a.$ && b.$ && a.$.PartNumber > b.$.PartNumber) {
                                    return 1;
                                }
                                else if (a.$ && b.$ && a.$.PartNumber < b.$.PartNumber) {
                                    return -1;
                                }
                                return 0;
                            })
                                .reduce((a, c) => {
                                a += c._;
                                return a;
                            }, '');
                        }
                        return resolve({
                            base64LabelImage,
                            trackingNumber: lr.TrackingNumber,
                            postageAmount: lr.FinalPostage,
                        });
                    }
                });
            });
        });
    }
    refundLabel(trackingNumber) {
        return __awaiter(this, void 0, void 0, function* () {
            const xml = this.getBase('RefundRequest')
                .ele('PicNumbers')
                .ele('PicNumber', trackingNumber).up()
                .end({ pretty: true });
            const response = yield this.request('/GetRefundXML?refundRequestXML=' + xml);
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
