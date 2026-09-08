import { FC, useEffect, useState } from "react";
import { Button } from "./ui/button";
import { AuditLog } from "../data/type";
import { onGetService } from "../data/service";

interface AuditModalProps {
  onClose: () => void;
  idAfter: string; // documentId
  type: "Goods" | "User" | "Reservation" | "Trip" | "Boat" | "CashMovement" | "FuelConsumption";
}

const AuditModal: FC<AuditModalProps> = ({ onClose, type, idAfter }) => {
  const [logs, setLogs] = useState<AuditLog[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      const data = await onGetService<AuditLog>(`audit/${idAfter}`);
      console.log(data , idAfter);
      setLogs(data);
    };
    fetchData();
  }, [idAfter, type]);

  const renderDiff = (log: AuditLog) => {
    if (log.action === "create") {
      return (
        <div className="text-green-700">
          <p className="font-semibold">Création :</p>
          <ul className="list-disc pl-5">
            {Object.entries(log.after).map(([key, value]) => (
              <li key={key}>
                <span className="font-medium">{key}</span>: {String(value)}
              </li>
            ))}
          </ul>
        </div>
      );
    }

    if (log.action === "delete") {
      return (
        <div className="text-red-700">
          <p className="font-semibold">Suppression :</p>
          <ul className="list-disc pl-5">
            {Object.entries(log.before || {}).map(([key, value]) => (
              <li key={key}>
                <span className="font-medium">{key}</span>: {String(value)}
              </li>
            ))}
          </ul>
        </div>
      );
    }

    if (log.action === "update") {
      return (
        <div className="text-blue-700">
          <p className="font-semibold">Mise à jour :</p>
          <ul className="list-disc pl-5">
            {Object.keys(log.after).map((key) => {
              const beforeVal = (log.before as any)?.[key];
              const afterVal = (log.after as any)?.[key];
              if (beforeVal !== afterVal) {
                return (
                  <li key={key}>
                    <span className="font-medium">{key}</span>: 
                    <span className="text-red-500 line-through ml-2">{String(beforeVal)}</span> → 
                    <span className="text-green-600 ml-2">{String(afterVal)}</span>
                  </li>
                );
              }
              return null;
            })}
          </ul>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50">
      <div className="bg-black/50 bg-opacity-50 fixed inset-0" onClick={onClose}></div>
      <div className="flex flex-col bg-white rounded-lg shadow-lg p-6 z-10 max-h-[80vh] overflow-y-auto w-11/12 md:w-3/4 lg:w-1/2">
        <h2 className="text-2xl font-bold mb-4">Historique des audits - {type}</h2>

        <div className="space-y-6">
          {logs.length === 0 && <p className="text-gray-500">Aucun audit trouvé.</p>}

          {logs.map((log) => (
            <div key={log._id} className="p-4 border rounded bg-gray-50 shadow-sm">
              <p className="text-sm text-gray-500">
                {/* <span className="font-semibold">{`${findUser(log.userId).name, allUser}  `}</span> a fait un{" "} */}
                <span className="font-semibold">{log.userId}</span> a fait un{" "}
                <span className="font-semibold">{log.action}</span> le{" "}
                {new Date(log.createdAt).toLocaleString()}
              </p>
              <div className="mt-2">{renderDiff(log)}</div>
            </div>
          ))}
        </div>

        <Button className="mt-6 self-end" onClick={onClose}>
          Fermer
        </Button>
      </div>
    </div>
  );
};

export default AuditModal;
