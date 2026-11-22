import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Join CivicTrack</h1>
          <p className="mt-1 text-sm text-muted-foreground">Create your citizen account</p>
        </div>
        <SignUp routing="path" path="/sign-up" fallbackRedirectUrl="/citizen" />
      </div>
    </div>
  );
}
