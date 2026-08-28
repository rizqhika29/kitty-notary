import ClaimForm from "@/components/ClaimForm";

export const metadata = {
  title: "Submit Claim | KittyNotary",
  description: "Submit a claim for on-chain notarization",
};

export default function SubmitPage() {
  return <ClaimForm />;
}