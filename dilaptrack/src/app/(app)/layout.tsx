import { Logo } from "@/components/shell/logo";
import { MobileTabBar, SidebarNav } from "@/components/shell/app-nav";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { UserMenu } from "@/components/shell/user-menu";
import { requireSession } from "@/lib/auth";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const { profile, can } = await requireSession();

  return (
    <div className="min-h-dvh lg:pl-60">
      <aside className="no-print fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-border bg-card px-3 py-4 lg:flex">
        <div className="px-2 pb-6">
          <Logo />
        </div>
        <SidebarNav can={can} />
        <div className="mt-auto px-2">
          <ThemeToggle />
        </div>
      </aside>

      <header className="no-print sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b border-border bg-card/90 px-4 backdrop-blur sm:px-6">
        <div className="lg:hidden">
          <Logo />
        </div>
        <div className="hidden lg:block" />
        <UserMenu name={profile.full_name || profile.email} email={profile.email} role={profile.role} can={can} />
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 pt-5 pb-24 sm:px-6 lg:pb-10">{children}</main>

      <MobileTabBar can={can} />
    </div>
  );
}
