import Link from "next/link";
import { ArrowLeft, Compass } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background text-foreground text-center">
      <div className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center text-primary mb-4 shadow-lg border border-border">
        <Compass className="w-7 h-7" />
      </div>
      <h1 className="text-3xl font-extrabold tracking-tight mb-2">Page Not Found</h1>
      <p className="text-xs text-muted-foreground max-w-sm mb-6 leading-relaxed">
        The requested civic portal page or complaint record could not be found or has moved.
      </p>
      <Link
        href="/"
        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground font-semibold text-xs shadow-md hover:bg-primary/90 transition-all"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Return to CivicTrack Home</span>
      </Link>
    </div>
  );
}
