import { FC, useState } from "react";
import { Ship, Menu, X, LogOut } from "lucide-react";
import { cn } from "./ui/utils";
import { Button } from "./ui/button";
import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch, RootState } from "../redux/index";
import { logout } from "../redux/feature/users";
import { menuItems } from "./SidebarMenue";

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const Sidebar: FC<SidebarProps> = ({ activeTab, onTabChange }) => {
  const date = new Date();
  const dispatch: AppDispatch = useDispatch();
  const currentUser = useSelector((state: RootState) => state.users.currentUser);
  const rolesState = useSelector((state: RootState) => state.roles);

  // Permissions
  const userPermissions = currentUser
    ? [
        ...(rolesState.permissions[currentUser.role] || []),
        ...(currentUser.permissions || []),
      ]
    : [];

  const filteredMenu = menuItems.filter((item) =>
    userPermissions.includes(item.permission)
  );

  const handleLogout = () => {
    dispatch(logout());
    dispatch({ type: "roles/reset" });
  };

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  return (
    <>
      {/* Bouton mobile */}
      <div className="md:hidden p-2">
        <Button
          variant="ghost"
          onClick={() => setIsMobileOpen(!isMobileOpen)}
          className="text-sidebar-foreground"
        >
          {isMobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </div>

      {/* Sidebar */}
      <div
        className={cn(
          "bg-sidebar border-r border-sidebar-border h-screen flex flex-col transition-all duration-300 fixed md:static top-0 left-0 z-50",
          isCollapsed ? "w-20" : "w-72",
          // Mobile
          isMobileOpen ? "translate-x-0" : "-translate-x-full",
          "md:translate-x-0"
        )}
      >
        {/* Header */}
        <div className="flex justify-between items-center gap-2 p-2 border-b border-sidebar-border">
          {!isCollapsed && (
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-sidebar-primary rounded-lg flex items-center justify-center">
                <Ship className="h-6 w-6 text-sidebar-primary-foreground" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-sidebar-foreground">
                  SaintJUDE
                </h1>
                {currentUser && (
                  <p className="text-xs text-sidebar-foreground/70">
                    {`${currentUser.name} ${currentUser.lastName}`}
                  </p>
                )}
              </div>
            </div>
          )}
          <Button
            variant="ghost"
            size="lg"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="hidden md:flex text-sidebar-foreground hover:bg-sidebar-accent"
          >
            {isCollapsed ? <Menu className="h-4 w-4" /> : <X className="h-4 w-4" />}
          </Button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {filteredMenu.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => {
                  onTabChange(item.id);
                  setIsMobileOpen(false); // ferme sur mobile
                }}
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-left transition-colors ${
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                }`}
              >
                <Icon className="h-5 w-5" />
                {!isCollapsed && (
                  <div className="flex-1">
                    <div className="font-medium">{item.label}</div>
                    <div className="text-xs opacity-70">{item.description}</div>
                  </div>
                )}
              </button>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-sidebar-border flex flex-col gap-2">
          <Button
            variant="destructive"
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2"
          >
            <LogOut />
            {!isCollapsed && "Se déconnecter"}
          </Button>
          <div className="text-xs text-sidebar-foreground/70 text-center">
            © {date.getFullYear()} SaintJUDE
          </div>
        </div>
      </div>

      {/* Overlay mobile */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/40 md:hidden z-40"
          onClick={() => setIsMobileOpen(false)}
        />
      )}
    </>
  );
};

export default Sidebar;
