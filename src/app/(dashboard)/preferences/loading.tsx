import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function PreferencesLoading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-64" />
      </div>

      {/* Instruction card */}
      <Card>
        <CardHeader className="space-y-2">
          <Skeleton className="h-5 w-56" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-6 w-36" />
          </div>
        </CardContent>
      </Card>

      {/* Two-column layout */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left: Available Sessions */}
        <div className="space-y-4">
          <Skeleton className="h-6 w-44" />
          <div className="space-y-2">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </div>

        {/* Right: My Rankings */}
        <div className="space-y-4">
          <Skeleton className="h-6 w-32" />
          <div className="space-y-2">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
          <Skeleton className="h-11 w-full" />
        </div>
      </div>
    </div>
  );
}
