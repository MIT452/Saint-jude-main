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
import { useSelector } from "react-redux";
import { RootState } from "./redux";
import { menuItems } from "./components/SidebarMenue";
import { fetchDatabase } from "./redux/thunk/featchData";
import { useAppDispatch } from "./redux/hooks";

const App = () => {
  const currentUser = useSelector((state: RootState) => state.users.currentUser);
  const rolesState = useSelector((state: RootState) => state.roles);
  const dispatch = useAppDispatch();
  useEffect(() => {
    dispatch(fetchDatabase());
  }, []);
  // Récupère les permissions de l'utilisateur selon son rôle
  const userPermissions = currentUser
    ? [
      ...(rolesState.permissions[currentUser.role] || []),
      ...(currentUser.permissions || []),
    ]
    : [];
  const firstAllowedMenu = menuItems.find(item =>
    userPermissions.includes(item.permission)
  );
  const [activeTab, setActiveTab] = useState(firstAllowedMenu?.id || "profile");
  const onChangeNav = (value: string) => {
    setActiveTab(value);
  }

  const renderContent = () => {
    switch (activeTab) {
      case "dashboard":
        return <Dashboard onSetToAudit={onChangeNav} />
      case "merchandise":
        return <Goods />
      case "casing":
        return <CashMouvement onSetTofeuldManage={onChangeNav} />
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
      default:
        return <Profile />
    }
  }

  return (
    <div className="size-full flex bg-background">
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />
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
          rtl={false}
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