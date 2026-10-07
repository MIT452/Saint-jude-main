import axios from "axios";

const API = import.meta.env.VITE_API_URL || "https://saint-jude-back.onrender.com/api";

export interface PositionPayload {
  boatId: string;
  latitude: number;
  longitude: number;
  speed?: number;
}

export interface OptimizationPayload {
  depart: string;
  escales: string[];
}

export interface ChatPayload {
  question: string;
}

export const getLatestPosition = async (boatId: string) => {
  const { data } = await axios.get(`${API}/positions/${boatId}/latest`, { withCredentials: true });
  return data;
};

export const postPosition = async (position: PositionPayload) => {
  const { data } = await axios.post(`${API}/positions`, position, { withCredentials: true });
  return data;
};

export const optimizeRoute = async (payload: OptimizationPayload) => {
  const { data } = await axios.post(`${API}/optimization/order`, payload, { withCredentials: true });
  return data;
};

export const optimizePath = async (depart: string, arrivee: string) => {
  const { data } = await axios.get(`${API}/optimization/path`, {
    params: { depart, arrivee },
    withCredentials: true,
  });
  return data;
};

export const askAssistant = async (payload: ChatPayload) => {
  const { data } = await axios.post(`${API}/ai/chat`, payload, { withCredentials: true });
  return data;
};

export const tapRag = async (query: string) => {
  const { data } = await axios.post(`${API}/ai/rag`, { query }, { withCredentials: true });
  return data;
};

export const selectTools = async (question: string) => {
  const { data } = await axios.post(`${API}/ai/jit`, { question }, { withCredentials: true });
  return data;
};

export const runMultiAgent = async (question: string) => {
  const { data } = await axios.post(`${API}/ai/multi-agent`, { question }, { withCredentials: true });
  return data;
};

export const evaluateAnswer = async (answer: string, expected?: string) => {
  const { data } = await axios.post(`${API}/ai/evaluate`, { answer, expected }, { withCredentials: true });
  return data;
};

export const classifyIntent = async (message: string) => {
  const { data } = await axios.post(`${API}/ai-capabilities/classify`, { message }, { withCredentials: true });
  return data;
};

export const getCapabilitiesStatus = async () => {
  const { data } = await axios.get(`${API}/ai-capabilities/status`, { withCredentials: true });
  return data;
};

export const getAiStatus = async () => {
  const { data } = await axios.get(`${API}/ai-capabilities/status`, { withCredentials: true });
  return data;
};

export const getOptimizationPath = async (depart: string, arrivee: string) =>
  optimizePath(depart, arrivee);

export const getRealtimeOrigin = () =>
  import.meta.env.VITE_SOCKET_URL || "https://saint-jude-back.onrender.com";
