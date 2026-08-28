import RecordsTable from "@/components/RecordsTable";

export const metadata = {
  title: "Records | KittyNotary",
  description: "Browse all notarization records",
};

export default function RecordsPage() {
  return <RecordsTable mode="mine" />;
}