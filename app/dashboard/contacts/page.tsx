import { getContacts } from "@/lib/actions/contacts";
import { ContactsPageClient } from "./client";

export default async function ContactsPage() {
  const { data } = await getContacts();

  return <ContactsPageClient initialContacts={data} />;
}
