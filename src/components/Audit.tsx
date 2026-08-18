import { FC, useEffect, useState } from "react";
import { onGetService } from "../data/service";
import { AuditLog } from "../data/type";
import { findUser } from "../Tools/Tools";
import { useSelector } from "react-redux";
import { RootState } from "../redux";
import AuditModal from "./AuditModal";
type types = "Goods" | "User" | "Reservation" | "Trip" | "Boat" | "CashMovement" | "FuelConsumption";
const AuditLogs: FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [showModalAudit, setShowModalAudit] = useState<boolean>(false);
  const [auditShow, setAuditShow] = useState<{ idAudit: string, type: types }>()

  const allUser = useSelector((state: RootState) => state.users.allUser);
  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const response = await onGetService<AuditLog>("allaudit");
        setLogs(response);
      } catch (error) {
        console.error("Erreur lors de la récupération des logs", error);
      } finally {
        setLoading(false);
      }
    };

    fetchLogs();
  }, []);

  if (loading) {
    return <p className="text-center p-4">Chargement des logs...</p>;
  }

  return (
    <div className="p-6">
      <h2 className="text-xl font-bold mb-4">📜 Audit Logs</h2>

      {logs.length === 0 ? (
        <p>Aucun log disponible.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg shadow-md">
          <table className="min-w-full bg-white border">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-3 border">Action</th>
                <th className="p-3 border">Collection</th>
                <th className="p-3 border">Document ID</th>
                <th className="p-3 border">Utilisateur</th>
                <th className="p-3 border">Date</th>
              </tr>
            </thead>
            <tbody>
              {
                logs.map((log) => {
                  const user = findUser(log.userId, allUser)
                  return <tr key={log._id} className="hover:bg-gray-50" onClick={() => { setAuditShow({ idAudit: log.after.id, type: log.collectionName }); setShowModalAudit(true) }} style={{ cursor: 'pointer' }}>
                    <td className="p-3 border font-medium">{log.action === "create" ? "Ajout" : log.action === "delete" ? "Suppression" : "Modification"}</td>
                    <td className="p-3 border">{log.collectionName}</td>
                    <td className="p-3 border">{log.documentId}</td>
                    <td className="p-3 border">{`${user.name} ${user.lastName}`}</td>
                    <td className="p-3 border">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                  </tr>
                })
              }
            </tbody>
          </table>
        </div>
      )}
      {showModalAudit && auditShow && <AuditModal idAfter={auditShow.idAudit} onClose={() => setShowModalAudit(false)} type={auditShow.type} />}
    </div>
  );
};

export default AuditLogs;
