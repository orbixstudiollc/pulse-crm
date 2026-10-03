import { defineField, STANDARD_OBJECT } from 'twenty-sdk/define';

import * as A from 'src/constants/agency-ids';
import { oneToMany } from 'src/gtm/sequences/relation-fields';

// Company side of the agency invoices relation.
export default defineField({
  objectUniversalIdentifier: STANDARD_OBJECT.company.universalIdentifier,
  ...oneToMany({
    universalIdentifier: A.COMPANY_INVOICES_UNIVERSAL_IDENTIFIER,
    name: 'clientInvoices',
    label: 'Invoices',
    icon: 'IconReceipt',
    targetObject: A.INVOICE_OBJECT_UNIVERSAL_IDENTIFIER,
    targetField: A.INVOICE_COMPANY_UNIVERSAL_IDENTIFIER,
  }),
});
