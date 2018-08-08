import * as xmlbuilder from 'xmlbuilder';
import { parseString } from 'xml2js';
import request from 'request-promise';
import { RequestAPI } from 'request';
import shortid from 'shortid';

export type EndiciaMailClassType =
  'PriorityExpress'
  | 'First'
  | 'LibraryMail'
  | 'MediaMail'
  | 'ParcelSelect'
  | 'RetailGround'
  | 'Priority'
  | 'PriorityMailExpressInternational'
  | 'FirstClassMailInternational'
  | 'FirstClassPackageInternationalService'
  | 'PriorityMailInternational'

export enum EndiciaEndpoints {
  test = 'https://elstestserver.endicia.com/LabelService/EwsLabelService.asmx',
  live = 'https://labelserver.endicia.com/LabelService/EwsLabelService.asmx',
}

export enum EndiciaMailClass {
  PriorityExpress = 'PriorityExpress',
  First = 'First',
  LibraryMail = 'LibraryMail',
  MediaMail = 'MediaMail',
  ParcelSelect = 'ParcelSelect',
  RetailGround = 'RetailGround',
  Priority = 'Priority',
  PriorityMailExpressInternational = 'PriorityMailExpressInternational',
  FirstClassMailInternational = 'FirstClassMailInternational',
  FirstClassPackageInternationalService = 'FirstClassPackageInternationalService',
  PriorityMailInternational = 'PriorityMailInternational'
}

export interface EndiciaOptions {
  mode: 'test' | 'live',
  accountId: number;
  passPhrase: string;
  requesterId?: string;
  label?: {
    shipFrom?: ShippingAddress
  }
}

export interface ShippingAddress {
  name: string;
  careOf?: string;
  address1: string;
  address2?: string;
  city: string;
  stateProvince: string;
  postalCode: string;
  countryCode: string;
  phone?: string;
}

export interface PostageLabelOption {
  replyPostage?: boolean,
  shipTo: ShippingAddress,
  shipFrom?: ShippingAddress,
  mailClass: EndiciaMailClassType;
  requireCustomForm: boolean;
  weight: number;
  totalPrice: number;
  mailPieceShape: string;
  showReturnAddress?: boolean;
  orderReference?: string;
  customerReference?: string;
  imageRotation?: string;
  labelSize?: string;
  fileType?: string;
  imageResolution?: string;
  labelType?: string;
  labelSubtype?: string;
}

export interface ShipRateOption {
  shipToPostalCode: string;
  shipFromPostalCode?: string;
  mailClass: string;
  weight: number;
  mailPieceShape: string;
}

function removeIllegalSymbols(str) {
  return String(str).replace(/#/g, '').replace(/’/g, '`');
}

export default class Endicia {
  options: EndiciaOptions;
  request: RequestAPI<any, any, any>;
  mode: string;
  accountId: number;
  passPhrase: string;
  requesterId: string;

  constructor(options: EndiciaOptions) {
    const baseUrl = options.mode === 'live' ? EndiciaEndpoints.live : EndiciaEndpoints.test;

    this.options = options;
    this.request = request.defaults({ baseUrl });
    this.accountId = this.options.accountId;
    this.passPhrase = this.options.passPhrase;
    this.mode = this.options.mode;
    this.requesterId = this.options.requesterId;
  }

  getBase(root: string, credsInCertifiedIntermediary = true): xmlbuilder.XMLElementOrXMLNode {
    const base = xmlbuilder.create(root)
    .att('TokenRequested', 'false')
    .ele('RequesterID', this.requesterId).up()
    .ele('RequestID', shortid.generate()).up();

    if (credsInCertifiedIntermediary) {
      base.ele('CertifiedIntermediary')
      .ele('AccountID', this.accountId).up()
      .ele('PassPhrase', this.passPhrase).up();
    } else {
      base.ele('AccountID', this.accountId).up()
      .ele('PassPhrase', this.passPhrase).up();
    }

    return base;
  }

  async buyPostage(amount: number) {
    const xml = this.getBase('RecreditRequest')
    .ele('RecreditAmount', amount)
    .end({ pretty: true });

    const response = await this.request('/BuyPostageXML?recreditRequestXML=' + xml);

    return new Promise((resolve, reject) => {
      parseString(response, { explicitArray: false }, (err, data) => {
        if (err) {
          reject(err);
        } else {
          resolve(data);
        }
      });
    });
  }

  async rateSingle(data: ShipRateOption) {
    const xml = this.getBase('PostageRateRequest')
    .ele('MailClass', data.mailClass).up()
    .ele('WeightOz', data.weight).up()
    .ele('MailpieceShape', data.mailPieceShape).up()
    .ele('FromPostalCode', data.shipFromPostalCode).up()
    .ele('ToPostalCode', data.shipToPostalCode).up()
    .end({ pretty: true });

    const response = await this.request('/CalculatePostageRateXML?postageRateRequestXML=' + xml);

    return new Promise((resolve, reject) => {
      parseString(response, { explicitArray: false }, (err, data) => {
        if (data && data.PostageRateResponse.Postage) {
          const rate = data.PostageRateResponse.Postage.Rate;
          return resolve(rate);
        }
      });
    });
  }

  async getPostageLabel(data: PostageLabelOption) {
    if (!data.shipFrom && (!this.options.label || !this.options.label.shipFrom)) {
      throw Error('Ship From must be included');
    }
    const shipFrom = data.shipFrom || this.options.label.shipFrom;
    const { requireCustomForm } = data;

    const xml = this.getBase('LabelRequest', false)
    .att('Test', this.mode !== 'live' ? 'YES' : 'NO')
    .att('LabelType', data.labelType || 'Default')
    .att('LabelSubtype', data.labelSubtype || 'None')
    .att('LabelSize', data.labelSize || '4x6')
    .att('ImageFormat', data.fileType || 'EPL2')
    .att('ImageResolution', data.imageResolution || '203')
    .att('ImageRotation', data.imageRotation || 'NONE')
    .ele('ReplyPostage', Boolean(data.replyPostage)).up()
    .ele('MailClass', data.mailClass).up()
    .ele('WeightOz', data.weight).up()
    .ele('MailpieceShape', data.mailPieceShape).up()
    .ele('ShowReturnAddress', data.showReturnAddress || 'TRUE').up()
    .ele('PartnerTransactionID', data.orderReference || shortid.generate()).up()
    .ele('PartnerCustomerID', data.customerReference || shortid.generate()).up()

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
    .ele('ToPostalCode', removeIllegalSymbols(data.shipTo.postalCode).split('-')[0]).up();

    if (removeIllegalSymbols(data.shipTo.postalCode).split('-')[1] && requireCustomForm) {
      xml.ele('ToZIP4', removeIllegalSymbols(data.shipTo.postalCode).split('-')[1]).up();
    }

    if (requireCustomForm) {
      xml
      .ele('ToCountryCode', data.shipTo.countryCode).up()
      .ele('CustomsInfo')
      .ele('ContentsType', 'Merchandise').up()
      .ele('CustomsItems')
      .ele('CustomsItem')
      .ele('Description', 'vitamins').up()
      .ele('Quantity', 1).up()
      .ele('Weight', data.weight).up()
      .ele('Value', data.totalPrice).up()
      .end({ pretty: true });
    } else {
      xml
      .ele('ToCountryCode', 'US').up()
      .end({ pretty: true });
    }

    const response = await this.request('/GetPostageLabelXML?labelRequestXML=' + xml);

    return new Promise((resolve, reject) => {
      parseString(response, { explicitArray: false }, (err, data) => {
        if (data && data.LabelRequestResponse) {
          const lr = data.LabelRequestResponse;

          if (lr.ErrorMessage) {
            return reject(new Error(lr.ErrorMessage));
          }

          return resolve({
            base64LabelImage: requireCustomForm ? lr.Label.Image._ : lr.Base64LabelImage,
            trackingNumber: lr.TrackingNumber,
            postageAmount: lr.FinalPostage,
          });
        }
      });
    });
  }

  async refundLabel(trackingNumber: string) {
    const xml = this.getBase('RefundRequest')
    .ele('PicNumbers')
    .ele('PicNumber', trackingNumber).up()
    .end({ pretty: true });

    const response = await this.request('/GetRefundXML?refundRequestXML=' + xml);

    return new Promise((resolve, reject) => {
      parseString(response, { explicitArray: false }, (err, data) => {
        if (err) {
          reject(err);
        } else {
          resolve(data);
        }
      });
    });
  }

  async changePassword(newPassPhrase: string) {
    const xml = this.getBase('ChangePassPhraseRequest')
    .ele('NewPassPhrase', newPassPhrase)
    .end({ pretty: true });

    const response = this.request('/ChangePassPhraseXML?changePassPhraseRequestXML=' + xml);

    return new Promise((resolve, reject) => {
      parseString(response, { explicitArray: false }, (err, data) => {
        if (err) {
          reject(err);
        } else {
          resolve(data);
        }
      });
    });
  }
}
