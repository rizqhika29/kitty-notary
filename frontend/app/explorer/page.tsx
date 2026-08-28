import RecordsTable from "@/components/RecordsTable";

export const metadata = {
  title: "Explorer | KittyNotary",
  description: "Browse all notarization records with per-user filters",
};

export default function ExplorerPage() {
  return <RecordsTable mode="all" />;
}