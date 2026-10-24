import { AdminNav } from "./admin-nav";

// The menu only. Each admin page checks that the viewer is an admin, and the
// database refuses admin actions from anyone else regardless.
export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="flex flex-col gap-6">
      <AdminNav />
      {children}
    </div>
  );
}
