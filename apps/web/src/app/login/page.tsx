import { Suspense } from "react";
import LoginContent from "./logincontent";

export default function Page() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <LoginContent />
    </Suspense>
  );
}