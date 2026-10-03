import { defineView, ViewType } from 'twenty-sdk/define';

import * as A from 'src/constants/agency-ids';

export default defineView({
  universalIdentifier: A.INVOICES_VIEW_UNIVERSAL_IDENTIFIER,
  name: 'Invoices',
  objectUniversalIdentifier: A.INVOICE_OBJECT_UNIVERSAL_IDENTIFIER,
  type: ViewType.TABLE,
  icon: 'IconReceipt',
  position: 0,
  fields: [
    { universalIdentifier: A.INVOICES_VIEW_F_NAME_UNIVERSAL_IDENTIFIER, fieldMetadataUniversalIdentifier: A.INVOICE_NAME_UNIVERSAL_IDENTIFIER, position: 0, size: 200 },
    { universalIdentifier: A.INVOICES_VIEW_F_STATUS_UNIVERSAL_IDENTIFIER, fieldMetadataUniversalIdentifier: A.INVOICE_STATUS_UNIVERSAL_IDENTIFIER, position: 1, size: 110 },
    { universalIdentifier: A.INVOICES_VIEW_F_AMOUNT_UNIVERSAL_IDENTIFIER, fieldMetadataUniversalIdentifier: A.INVOICE_AMOUNT_UNIVERSAL_IDENTIFIER, position: 2, size: 110 },
    { universalIdentifier: A.INVOICES_VIEW_F_COMPANY_UNIVERSAL_IDENTIFIER, fieldMetadataUniversalIdentifier: A.INVOICE_COMPANY_UNIVERSAL_IDENTIFIER, position: 3, size: 170 },
    { universalIdentifier: A.INVOICES_VIEW_F_DUE_DATE_UNIVERSAL_IDENTIFIER, fieldMetadataUniversalIdentifier: A.INVOICE_DUE_DATE_UNIVERSAL_IDENTIFIER, position: 4, size: 110 },
    { universalIdentifier: A.INVOICES_VIEW_F_SENT_AT_UNIVERSAL_IDENTIFIER, fieldMetadataUniversalIdentifier: A.INVOICE_SENT_AT_UNIVERSAL_IDENTIFIER, position: 5, size: 140 },
    { universalIdentifier: A.INVOICES_VIEW_F_PAID_AT_UNIVERSAL_IDENTIFIER, fieldMetadataUniversalIdentifier: A.INVOICE_PAID_AT_UNIVERSAL_IDENTIFIER, position: 6, size: 140 },
  ],
});
