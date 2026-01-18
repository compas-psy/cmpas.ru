import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Вход | Compas",
    description: "Авторизация в системе Compas",
    robots: {
        index: false,
        follow: false,
    },
};

export default function AuthLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <>{children}</>;
}
