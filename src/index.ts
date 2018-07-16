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
  phone?: string;
}

export interface PostageLabelOption {
  shipTo: ShippingAddress,
  shipFrom?: ShippingAddress,
  mailClass: EndiciaMailClassType;
  weight: number;
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

    const response = this.request('/BuyPostageXML?recreditRequestXML=' + xml);

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

    const imageRotation = data.imageRotation || 'NONE';
    const labelSize = data.labelSize || '4x6';
    const labelType = data.labelSize || 'Default';
    const labelSubtype = data.labelSize || 'None';

    const xml = this.getBase('LabelRequest', false)
    .att('Test', this.mode !== 'live' ? 'YES' : 'NO')
    .att('LabelType', 'Default')
    .att('LabelSubtype', 'None')
    .att('LabelSize', labelSize)
    .att('ImageFormat', data.fileType || 'PNG')
    .att('ImageResolution', data.imageResolution || '300')
    .att('ImageRotation', imageRotation)
    .ele('MailClass', data.mailClass).up()
    .ele('WeightOz', data.weight).up()
    .ele('MailpieceShape', data.mailPieceShape).up()
    .ele('ShowReturnAddress', data.showReturnAddress || 'TRUE').up()
    .ele('PartnerTransactionID', data.orderReference || shortid.generate()).up()
    .ele('PartnerCustomerID', data.customerReference || shortid.generate()).up()

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

    const response = await this.request('/GetPostageLabelXML?labelRequestXML=' + xml);

    return new Promise((resolve, reject) => {
      parseString(response, { explicitArray: false }, (err, data) => {
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
