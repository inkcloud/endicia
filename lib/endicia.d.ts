import * as xmlbuilder from 'xmlbuilder';
import { RequestAPI } from 'request';
export declare enum EndiciaEndpoints {
    test = "https://elstestserver.endicia.com/LabelService/EwsLabelService.asmx",
    live = "https://labelserver.endicia.com/LabelService/EwsLabelService.asmx"
}
export declare type EndiciaMailClassType = 'PriorityExpress' | 'First' | 'LibraryMail' | 'MediaMail' | 'ParcelSelect' | 'RetailGround' | 'Priority' | 'PriorityMailExpressInternational' | 'FirstClassMailInternational' | 'FirstClassPackageInternationalService' | 'PriorityMailInternational';
export declare enum EndiciaMailClass {
    PriorityExpress = "PriorityExpress",
    First = "First",
    LibraryMail = "LibraryMail",
    MediaMail = "MediaMail",
    ParcelSelect = "ParcelSelect",
    RetailGround = "RetailGround",
    Priority = "Priority",
    PriorityMailExpressInternational = "PriorityMailExpressInternational",
    FirstClassMailInternational = "FirstClassMailInternational",
    FirstClassPackageInternationalService = "FirstClassPackageInternationalService",
    PriorityMailInternational = "PriorityMailInternational"
}
export interface EndiciaOptions {
    mode: 'test' | 'live';
    accountId: number;
    passPhrase: string;
    requesterId?: string;
    label?: {
        shipFrom?: ShippingAddress;
    };
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
    shipTo: ShippingAddress;
    shipFrom?: ShippingAddress;
    mailClass: EndiciaMailClassType;
    weight: number;
    mailPieceShape: string;
    showReturnAddress?: boolean;
    orderReference?: string;
    customerReference?: string;
}
export interface ShipRateOption {
    shipToPostalCode: string;
    shipFromPostalCode?: string;
    mailClass: string;
    weight: number;
    mailPieceShape: string;
}
export declare class Endicia {
    options: EndiciaOptions;
    request: RequestAPI<any, any, any>;
    mode: string;
    accountId: number;
    passPhrase: string;
    requesterId: string;
    constructor(options: EndiciaOptions);
    getBase(root: string, credsInCertifiedIntermediary?: boolean): xmlbuilder.XMLElementOrXMLNode;
    buyPostage(amount: number): Promise<any>;
    rateSingle(data: ShipRateOption): Promise<{}>;
    getPostageLabel(data: PostageLabelOption): Promise<{}>;
    changePassword(newPassPhrase: string): Promise<any>;
}
