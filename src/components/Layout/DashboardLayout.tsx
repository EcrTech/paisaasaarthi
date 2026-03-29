import { ReactNode, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import logo from "@/assets/paisaa-saarthi-logo.jpeg";
import {
  LayoutDashboard,
  Settings,
  Users,
  User,
  LogOut,
  Menu,
  X,
  Contact,
  GitBranch,
  BarChart3,
  Network,
  UserCog,
  TrendingUp,
  Lightbulb,
  UsersRound,
  Layers,
  PhoneCall,
  Package,
  Award,
  FileText,
  List,
  Sliders,
  Building2,
  Webhook,
  MessageSquare,
  Mail,
  Send,
  Database,
  CreditCard,
  Activity,
  Key,
  Star,
  MessageCircle,
  Phone,
  Sparkles,
  MapPinOff,
  IndianRupee,
  CheckSquare,
  Shield,
  HardDrive,
} from "lucide-react";
import { useNotification } from "@/hooks/useNotification";
import { OnboardingDialog } from "@/components/Onboarding/OnboardingDialog";
import { useAuth } from "@/contexts/AuthContext";
import { useModuleTracking } from "@/hooks/useModuleTracking";
import { NotificationBell } from "./NotificationBell";
import { QuickDial } from "@/components/Contact/QuickDial";

interface DashboardLayoutProps {
  children: ReactNode;
}

function DashboardLayout({ children }: DashboardLayoutProps) {
  const navigate = useNavigate();
  const notify = useNotification();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  
  // Get all user data from centralized AuthContext - NO additional API calls!
  const { 
    userName, 
    orgLogo, 
    orgName, 
    userRole, 
    isAdmin, 
    canAccessFeature, 
    signOut,
    profile,
    isLoading: featureAccessLoading 
  } = useAuth();
  
  // Track module usage
  useModuleTracking();

  // Check if user needs onboarding (only once profile is loaded)
  const onboardingChecked = !!profile;
  const needsOnboarding = profile && !profile.onboarding_completed && userRole;

  const handleSignOut = async () => {
    await signOut();
    notify.success("Signed out", "You've been successfully signed out");
    navigate("/login");
  };

  const isManager = isAdmin || userRole === "sales_manager" || userRole === "support_manager";

  // Check if sections should be visible
  const showDashboardsSection = canAccessFeature("analytics") || canAccessFeature("calling") || 
    canAccessFeature("campaigns_email") || canAccessFeature("campaigns_whatsapp") || canAccessFeature("ai_insights");
  
  const showOperationsSection = canAccessFeature("campaigns_email") || canAccessFeature("contacts") || 
    canAccessFeature("pipeline_stages") || canAccessFeature("calling") || canAccessFeature("redefine_data_repository");
  
  
  const showManagementSection = isAdmin && (
    canAccessFeature("users") || 
    canAccessFeature("teams") || 
    canAccessFeature("designations") || 
    canAccessFeature("approval_matrix")
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile header */}
      <div className="lg:hidden bg-card border-b border-border px-4 py-3 flex items-center justify-between">
        <img src={orgLogo || logo} alt="Logo" className="h-12 object-contain" />
        <div className="flex items-center gap-2">
          <QuickDial />
          <NotificationBell />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            {sidebarOpen ? <X /> : <Menu />}
          </Button>
        </div>
      </div>

      <div className="flex">
        {/* Sidebar */}
        <aside
          className={`
            fixed lg:sticky inset-y-0 left-0 z-50 lg:top-0 lg:h-screen
            w-64 bg-card border-r border-border
            transform transition-transform duration-200 ease-in-out
            ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
          `}
        >
          <div className="h-full lg:h-screen flex flex-col overflow-y-auto">
            {/* Logo */}
            <div className="p-6 border-b border-border flex flex-col items-center bg-gradient-to-br from-primary/5 to-transparent">
              <img src={orgLogo || logo} alt="Logo" className="h-48 w-auto object-contain mb-3" />
              <Link 
                to="/profile" 
                className="text-sm font-medium text-foreground hover:text-primary transition-colors text-center"
                onClick={() => setSidebarOpen(false)}
              >
                {userName}
              </Link>
              <div className="mt-4 w-full">
                <QuickDial />
              </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 p-2 space-y-0.5">
              {/* Dashboards & Reports Section */}
              {showDashboardsSection && (
                <div className="pb-1 pt-1 section-accent-teal pl-3">
                  <p className="px-3 text-xs font-semibold uppercase tracking-wider gradient-text-primary">
                    Dashboards & Reports
                  </p>
                </div>
              )}
              
              {/* LOS Dashboard */}
              {canAccessFeature("los_dashboard") && (
                <Link
                  to="/los/dashboard"
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-accent hover:text-accent-foreground transition-all duration-200 text-sm"
                  onClick={() => setSidebarOpen(false)}
                >
                  <Activity size={18} />
                  <span>LOS Dashboard</span>
                </Link>
              )}

              {/* Sales & Operations Section */}
              {showOperationsSection && (
                <div className="pt-2 pb-1 section-accent-teal pl-3">
                  <p className="px-3 text-xs font-semibold uppercase tracking-wider gradient-text-primary">
                    Sales & Operations
                  </p>
                </div>
              )}

              {canAccessFeature("pipeline_stages") && (
                <Link
                  to="/pipeline"
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-accent hover:text-accent-foreground transition-all duration-200 text-sm"
                  onClick={() => setSidebarOpen(false)}
                >
                  <GitBranch size={18} />
                  <span>Leads</span>
                </Link>
              )}

              {canAccessFeature("loan_applications") && (
                <Link
                  to="/los/applications"
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-accent hover:text-accent-foreground transition-all duration-200 text-sm"
                  onClick={() => setSidebarOpen(false)}
                >
                  <FileText size={18} />
                  <span>Loan Applications</span>
                </Link>
              )}

              {canAccessFeature("approvals") && (
                <Link
                  to="/los/approval-queue"
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-accent hover:text-accent-foreground transition-all duration-200 text-sm"
                  onClick={() => setSidebarOpen(false)}
                >
                  <List size={18} />
                  <span>Approvals</span>
                </Link>
              )}

              {canAccessFeature("sanctions") && (
                <Link
                  to="/los/sanctions"
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-accent hover:text-accent-foreground transition-all duration-200 text-sm"
                  onClick={() => setSidebarOpen(false)}
                >
                  <FileText size={18} />
                  <span>Sanctions</span>
                </Link>
              )}

              {canAccessFeature("disbursals") && (
                <Link
                  to="/los/disbursals"
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-accent hover:text-accent-foreground transition-all duration-200 text-sm"
                  onClick={() => setSidebarOpen(false)}
                >
                  <CreditCard size={18} />
                  <span>Disbursals</span>
                </Link>
              )}

              {canAccessFeature("collections") && (
                <Link
                  to="/los/collections"
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-accent hover:text-accent-foreground transition-all duration-200 text-sm"
                  onClick={() => setSidebarOpen(false)}
                >
                  <IndianRupee size={18} />
                  <span>Collections</span>
                </Link>
              )}

              {canAccessFeature("los_reports") && (
                <Link
                  to="/los/relationships"
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-accent hover:text-accent-foreground transition-all duration-200 text-sm"
                  onClick={() => setSidebarOpen(false)}
                >
                  <Users size={18} />
                  <span>Reports</span>
                </Link>
              )}

              {isAdmin && canAccessFeature("emandate_settings") && (
                <Link
                  to="/los/settings/nupay"
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-accent hover:text-accent-foreground transition-all duration-200 text-sm"
                  onClick={() => setSidebarOpen(false)}
                >
                  <Webhook size={18} />
                  <span>eMandate Settings</span>
                </Link>
              )}

              {isAdmin && canAccessFeature("negative_pincodes") && (
                <Link
                  to="/los/negative-pincodes"
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-accent hover:text-accent-foreground transition-all duration-200 text-sm"
                  onClick={() => setSidebarOpen(false)}
                >
                  <MapPinOff size={18} />
                  <span>Negative Pin Codes</span>
                </Link>
              )}


              {canAccessFeature("communications") && (
                <Link
                  to="/communications"
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-accent hover:text-accent-foreground transition-all duration-200 text-sm"
                  onClick={() => setSidebarOpen(false)}
                >
                  <MessageSquare size={18} />
                  <span>Communications</span>
                </Link>
              )}

              {canAccessFeature("redefine_data_repository") && orgName.includes("Redefine") && (
                <Link
                  to="/redefine-repository"
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-accent hover:text-accent-foreground transition-all duration-200 text-sm"
                  onClick={() => setSidebarOpen(false)}
                >
                  <Database size={18} />
                  <span>Data Repository</span>
                </Link>
              )}

              {canAccessFeature("inventory") && orgName === "C.Parekh & Co" && (
                <Link
                  to="/inventory"
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-accent hover:text-accent-foreground transition-all duration-200 text-sm"
                  onClick={() => setSidebarOpen(false)}
                >
                  <Package size={18} />
                  <span>Inventory</span>
                </Link>
              )}

              {canAccessFeature("tasks") && (
                <Link
                  to="/tasks"
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-accent hover:text-accent-foreground transition-all duration-200 text-sm"
                  onClick={() => setSidebarOpen(false)}
                >
                  <CheckSquare size={18} />
                  <span>Tasks</span>
                </Link>
              )}

              {showManagementSection && (
                <>
                  <div className="pt-2 pb-1 section-accent-teal pl-3">
                    <p className="px-3 text-xs font-semibold uppercase tracking-wider gradient-text-primary">
                      Management
                    </p>
                  </div>
                  {canAccessFeature("users") && (
                    <Link
                      to="/users"
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-accent hover:text-accent-foreground transition-all duration-200 text-sm"
                      onClick={() => setSidebarOpen(false)}
                    >
                      <UserCog size={18} />
                      <span>Users</span>
                    </Link>
                  )}
                  {canAccessFeature("teams") && (
                    <Link
                      to="/teams"
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-accent hover:text-accent-foreground transition-all duration-200 text-sm"
                      onClick={() => setSidebarOpen(false)}
                    >
                      <UsersRound size={18} />
                      <span>Teams</span>
                    </Link>
                  )}
                  {canAccessFeature("designations") && (
                    <Link
                      to="/admin/designations"
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-accent hover:text-accent-foreground transition-all duration-200 text-sm"
                      onClick={() => setSidebarOpen(false)}
                    >
                      <Award size={18} />
                      <span>Designations</span>
                    </Link>
                  )}
                  <Link
                    to="/admin/access-management"
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-accent hover:text-accent-foreground transition-all duration-200 text-sm"
                    onClick={() => setSidebarOpen(false)}
                  >
                    <Shield size={18} />
                    <span>Access Management</span>
                  </Link>
                  <Link
                    to="/admin/dpdp-compliance"
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-accent hover:text-accent-foreground transition-all duration-200 text-sm"
                    onClick={() => setSidebarOpen(false)}
                  >
                    <Shield size={18} />
                    <span>DPDP Compliance</span>
                  </Link>
                  <Link
                    to="/admin/data-export"
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-accent hover:text-accent-foreground transition-all duration-200 text-sm"
                    onClick={() => setSidebarOpen(false)}
                  >
                    <HardDrive size={18} />
                    <span>Data Export & Backup</span>
                  </Link>
                </>
              )}


              {isAdmin && (
                <>
                  {(canAccessFeature("connectors") || canAccessFeature("api_keys")) && (
                    <div className="pt-2 pb-1 section-accent-teal pl-3">
                      <p className="px-3 text-xs font-semibold uppercase tracking-wider gradient-text-primary">
                        Integration & APIs
                      </p>
                    </div>
                  )}
                  
                  {canAccessFeature("connectors") && (
                    <Link
                      to="/admin/connectors"
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-accent hover:text-accent-foreground transition-all duration-200 text-sm"
                      onClick={() => setSidebarOpen(false)}
                    >
                      <Webhook size={18} />
                      <span>Webhook Connectors</span>
                    </Link>
                  )}
                  
                  {canAccessFeature("connectors") && (
                    <Link
                      to="/admin/outbound-webhooks"
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-accent hover:text-accent-foreground transition-all duration-200 text-sm"
                      onClick={() => setSidebarOpen(false)}
                    >
                      <Send size={18} />
                      <span>Outbound Webhooks</span>
                    </Link>
                  )}
                  
                  {canAccessFeature("exotel_settings") && (
                    <Link
                      to="/exotel-settings"
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-accent hover:text-accent-foreground transition-all duration-200 text-sm"
                      onClick={() => setSidebarOpen(false)}
                    >
                      <Phone size={18} />
                      <span>Exotel Settings</span>
                    </Link>
                  )}
                  
                </>
              )}
            </nav>

            {/* Profile and logout at bottom */}
            <div className="p-2 border-t border-border">
              <div className="flex items-center justify-between">
                <Link
                  to="/profile"
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-accent hover:text-accent-foreground transition-all duration-200 flex-1 text-sm"
                  onClick={() => setSidebarOpen(false)}
                >
                  <User size={18} />
                  <span>My Profile</span>
                </Link>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleSignOut}
                  className="text-muted-foreground hover:text-destructive h-8 w-8"
                  title="Sign Out"
                >
                  <LogOut size={18} />
                </Button>
              </div>
            </div>
          </div>
        </aside>

        {/* Overlay for mobile */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Main content */}
        <main className="flex-1">
          <div className="p-6 lg:p-8">
            {children}
          </div>
        </main>
      </div>
      
      {/* Onboarding Dialog */}
      {onboardingChecked && needsOnboarding && userRole && (
        <OnboardingDialog
          open={showOnboarding || !!needsOnboarding}
          userRole={userRole}
          onComplete={() => setShowOnboarding(false)}
        />
      )}
    </div>
  );
}

export default DashboardLayout;
export { DashboardLayout };
