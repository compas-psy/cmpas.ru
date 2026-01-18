import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Настройка профиля | Compas",
    description: "Настройка профиля пользователя",
    robots: {
        index: false,
        follow: false,
    },
};

export default function OnboardingLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <>{children}</>;
}
