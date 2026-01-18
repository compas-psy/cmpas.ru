import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
    "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
    {
        variants: {
            variant: {
                default: "border-transparent bg-primary text-white",
                secondary: "border-transparent bg-muted text-foreground",
                destructive: "border-destructive/20 bg-destructive/10 text-destructive",
                outline: "text-foreground",
                new: "border-[#f59e0b]/20 bg-[#f59e0b]/10 text-[#f59e0b]",
                processing: "border-blue-500/20 bg-blue-500/10 text-blue-600",
                paid: "border-primary/20 bg-primary/10 text-primary",
                completed: "border-gray-500/20 bg-gray-500/10 text-gray-600",
                cancelled: "border-destructive/20 bg-destructive/10 text-destructive",
            },
        },
        defaultVariants: {
            variant: "default",
        },
    }
);

export interface BadgeProps
    extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> { }

function Badge({ className, variant, ...props }: BadgeProps) {
    return (
        <div className={cn(badgeVariants({ variant }), className)} {...props} />
    );
}

export { Badge, badgeVariants };
