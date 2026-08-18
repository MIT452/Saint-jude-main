import { FC, useEffect, useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { Goods } from "../../data/type";
import { findGoods, findUser, formatCurrency } from "../../Tools/Tools";
import { useSelector } from "react-redux";
import { RootState } from "../../redux";
import { Pencil, Trash } from "lucide-react";
// import { upDateGood } from "../../redux/feature/stJude";

interface TableProps {
  currentGoods: Goods[];
  reservationClient: string;
  onUpdateGood: (good: Goods) => void;
  onDeleteGoods: (goodId :string)=> void
}


const Tables: FC<TableProps> = ({ currentGoods, reservationClient, onUpdateGood , onDeleteGoods}) => {
  const { allUser, currentUser } = useSelector((state: RootState) => state.users);
  // const dispatch = useDispatch();

  const [stateGoods, setStateGoods] = useState<Goods[]>(currentGoods);

  useEffect(() => { setStateGoods(currentGoods); }, [currentGoods]);
  useEffect(() => {
    setValues((prev) => {
      const updated = { ...prev };

      currentGoods.forEach((good) => {
        if (!updated[good.id]) {
          updated[good.id] = {
            client: reservationClient,
            itemName: good.itemName,
            quantity: good.quantity.toString(),
            unitWeight: good.unitWeight.toString(),
            unitPrice: good.unitPrice.toString(),
          };
        }
      });

      return updated;
    });
  }, [currentGoods, reservationClient]);


  // Ligne en mode "édition via Pencil"
  const [editingRowId, setEditingRowId] = useState<string | null>(null);

  // Gestion des valeurs des inputs (par ligne et champ)
  const [values, setValues] = useState<Record<string, Record<string, string>>>(
    () =>
      stateGoods.reduce((acc, good) => {
        acc[good.id] = {
          client: reservationClient,
          itemName: good.itemName,
          quantity: good.quantity.toString(),
          unitWeight: good.unitWeight.toString(),
          unitPrice: good.unitPrice.toString(),
        };
        return acc;
      }, {} as Record<string, Record<string, string>>)
  );


  // Gestion du double-clic par cellule
  const [activeCell, setActiveCell] = useState<{ rowId: string; field: string } | null>(null);

  const handleChange = (rowId: string, field: string, value: string) => {
    setValues((prev) => ({
      ...prev,
      [rowId]: { ...prev[rowId], [field]: value },
    }));
  };

  const handleDoubleClick = (rowId: string, field: string) => {
    setActiveCell({ rowId, field });

  };

  const handleBlur = (rowId: string) => {
    // Si la ligne n'est pas en mode édition via Pencil → retour readonly
    if (editingRowId !== rowId) {
      setActiveCell(null);
    }
    saveRow(rowId)
  };
  const saveRow = (rowId: string) => {
    const valuesRow = values[rowId];
    let currentGoods = findGoods(rowId, stateGoods);

    if (!currentGoods) return; // sécurité

    currentGoods = {
      ...currentGoods,
      itemName: valuesRow.itemName,
      quantity: Number(valuesRow.quantity) || 0,
      unitWeight: Number(valuesRow.unitWeight) || 0,
      unitPrice: Number(valuesRow.unitPrice) || 0,
      userId: currentUser ? currentUser.id : ""
    };

    // dispatch(upDateGood(currentGoods));
    onUpdateGood(currentGoods);
  };

  const toggleEditRow = (rowId: string) => {
    if (editingRowId === rowId) {
      // Si on reclique sur Pencil → sauvegarder et fermer édition
      saveRow(rowId);
      setEditingRowId(null);
    } else {
      setEditingRowId(rowId);
    }
  };
  
  return (
    <Table className="text-primary">
      <TableHeader>
        <TableRow>
          <TableHead>Client</TableHead>
          <TableHead>Marchandise</TableHead>
          <TableHead>Caissier</TableHead>
          <TableHead className="text-right">Quantité</TableHead>
          <TableHead className="text-right">Poids Unit. (kg)</TableHead>
          <TableHead className="text-right">Poids Total (kg)</TableHead>
          <TableHead className="text-right">Prix Unitaire</TableHead>
          <TableHead className="text-right">Prix Total</TableHead>
          <TableHead className="text-right">Action</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {stateGoods.map((good , key) => {
          const rowValues = values[good.id];

          const makeEditableCell = (field: string, inputType: string, alignRight?: boolean) => {
            const isActive =
              editingRowId === good.id || (activeCell?.rowId === good.id && activeCell?.field === field);

            return (
              <TableCell className={alignRight ? "text-right" : ""}>
                <input
                  type={inputType}
                  value={rowValues[field]}
                  readOnly={!isActive}
                  onDoubleClick={() => handleDoubleClick(good.id, field)}
                  onBlur={() => handleBlur(good.id)}
                  onChange={(e) => handleChange(good.id, field, e.target.value)}
                  className={`w-full px-2 py-1 text-sm ${alignRight ? "text-right" : "text-left"}  ${isActive ? "bg-white border border-blue-400 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                    : " border border-transparent rounded-md cursor-pointer"}  transition-all duration-150`}
                />
              </TableCell>

            );
          };

          return (
            <TableRow key={key} className="hover:bg-gray-50">
              {makeEditableCell("client", 'text')}
              {makeEditableCell("itemName", 'text')}
              {/* Caissier : jamais éditable */}
              <TableCell>
                {`${findUser(good.userId, allUser).name} ${findUser(good.userId, allUser).lastName}`}
              </TableCell>
              {makeEditableCell("quantity", 'number', true)}
              {makeEditableCell("unitWeight", 'number', true)}
              <TableCell className="text-right font-medium">{good.totalWeight}</TableCell>
              {makeEditableCell("unitPrice", 'number', true)}
              <TableCell className="text-right font-medium">{formatCurrency(good.totalPrice)}</TableCell>

              {/* Actions */}
              <TableCell className="flex gap-2">
                <Pencil className="cursor-pointer" size={16} onClick={() => toggleEditRow(good.id)} />
                <Trash className="cursor-pointer text-red-500" size={16} onClick={() => onDeleteGoods(good.id)} />
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
};

export default Tables;
