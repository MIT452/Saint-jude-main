import React from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

interface GPSMapProps {
  latitude: number;
  longitude: number;
  vesselName?: string;
}

export const GPSMap: React.FC<GPSMapProps> = ({ latitude, longitude, vesselName = "Navire Saint-Jude" }) => {
  const position: [number, number] = [latitude, longitude];

  return (
    <div className="w-full h-[350px] rounded-lg overflow-hidden border border-gray-200 shadow-sm relative">
      <MapContainer center={position} zoom={11} scrollWheelZoom={true} className="w-full h-full z-0">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker position={position}>
          <Popup>
            <div className="text-sm font-semibold">🚢 {vesselName}</div>
            <div className="text-xs text-gray-500">Lat: {latitude}, Lon: {longitude}</div>
          </Popup>
        </Marker>
      </MapContainer>
    </div>
  );
};