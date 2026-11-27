import { useEffect, useState } from "react";
import Sidebar from "./components/Sidebar";
import CashMouvement from "./components/CashMovement";
import Goods from "./components/Goods";
import Trip from "./components/Trip";
import BoatComponant from "./components/Boat";
import Dashboard from "./components/Dashboard";
import PersonnelManagement from "./components/PersonnelManagement";
import { ToastContainer } from 'react-toastify';
import Profile from "./components/Profile";
import FuelConsumption from "./components/FuelConsumption";
import Audit from "./components/Audit";
import IntelligenceDashboard from "./components/IntelligenceDashboard";
import ReservationExperience from "./components/ReservationExperience";
import DataAnalysis from "./components/DataAnalysis";
import NotificationSettingsPanel from "./components/NotificationSettingsPanel";
import AssistantIAPage from "./components/AssistantIAPage";
import PassengerReservation from "./components/PassengerReservation";
import { useSelector } from "react-redux";
import { RootState } from "./redux";
import { menuItems, clientMenuItems, isClientRole } from "./components/SidebarMenue";
import { fetchDatabase } from "./redux/thunk/featchData";
import { useAppDispatch } from "./redux/hooks";

const App = () => {
  const currentUser = useSelector((state: RootState) => state.users.currentUser);
  const rolesState = useSelector((state: RootState) => state.roles);
  const dispatch = useAppDispatch();
  useEffect(() => {
    dispatch(fetchDatabase());
  }, []);

  const isClient = isClientRole(currentUser?.role);

  // Récupère les permissions de l'utilisateur selon son rôle
  const userPermissions = currentUser
    ? [
      ...(rolesState.permissions[currentUser.role] || []),
      ...(currentUser.permissions || []),
    ]
    : [];
  const firstAllowedMenu = isClient
    ? clientMenuItems[0]
    : menuItems.find(item => userPermissions.includes(item.permission));
  const [activeTab, setActiveTab] = useState(firstAllowedMenu?.id || "profile");

  // Un Client ne peut ouvrir que ses 4 pages ; sinon retour à sa première entrée
  const clientIds = clientMenuItems.map((item) => item.id);
  const safeTab = isClient && !clientIds.includes(activeTab) ? clientIds[0] : activeTab;

  const renderContent = () => {
    switch (safeTab) {
      case "dashboard":
        return <Dashboard onSetToAudit={setActiveTab} />
      case "merchandise":
        return <Goods />
      case "casing":
        return <CashMouvement onSetTofeuldManage={setActiveTab} />
      case 'boat':
        return <BoatComponant />
      case "trajets":
        return <Trip />
      case "employe":
        return <PersonnelManagement />
      case "profile":
        return <Profile />
      case "fueldManage":
        return <FuelConsumption />
      case "Audit":
        return <Audit />
      case "intelligence":
        return <IntelligenceDashboard />
      case "reservations":
        return <ReservationExperience />
      case "notificationSettings":
        return <NotificationSettingsPanel />
      case "analytics":
        return <DataAnalysis />
      /* ----- Espace Client / Voyageur ----- */
      case "clientBoats":
        return <PassengerReservation />
      case "clientReservations":
        return <ReservationExperience />
      case "clientAssistant":
        return <AssistantIAPage />
      default:
        return <Profile />
    }
  }

  return (
    <div className="size-full flex bg-background">
      <Sidebar activeTab={safeTab} onTabChange={setActiveTab} />
      <main className="w-full h-[100vh] overflow-auto">
        <div className="p-4">
          {renderContent()}
        </div>
        <ToastContainer
          position="top-center"
          autoClose={7000}
          hideProgressBar={false}
          newestOnTop={false}
          closeOnClick
          pauseOnFocusLoss
          draggable
          pauseOnHover
        // bodyClassName="bg-primary text-white"
        />
      </main>
    </div>
  )
}
export default App;