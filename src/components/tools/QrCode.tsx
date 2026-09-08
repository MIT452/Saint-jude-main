import { QRCodeCanvas } from "qrcode.react";

interface TicketProps {
  idendifiant: string;
}

const Ticket = ({ idendifiant }: TicketProps) => {
  const qrValue = `reservation:${idendifiant}`; // Ce qu'on encode

  return (
    <QRCodeCanvas value={qrValue} size={50} />
  );
}

export default Ticket;