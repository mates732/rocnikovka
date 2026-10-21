import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./layouts/AppShell";
import {
  AnalysisPage,
  ExperimentPage,
  ExperimentVerificationPage,
  ImageWorkspacePage,
  ImagesPage,
  MeasurementDetailPage,
  MeasurementsPage,
  OverviewPage,
  PlantDetailPage,
  PlantsPage,
  PositionsPage,
  ProtocolPage,
  QualityControlPage,
  SettingsPage,
  ValidationPage,
  WaterPage,
} from "./pages";
import ExperimentSetupPage from "./pages/ExperimentSetupPage";
import DailyLabLogPage from "./pages/DailyLabLogPage";
import { Day0DashboardPage } from "./pages/Day0DashboardPage";
import { Day0EquipmentPage } from "./pages/Day0EquipmentPage";
import { Day0PhysicalConfigPage } from "./pages/Day0PhysicalConfigPage";
import { Day0PotAllocationPage } from "./pages/Day0PotAllocationPage";
import { Day0MethodologyPage } from "./pages/Day0MethodologyPage";
import { QuickCapturePage } from "./pages/QuickCapturePage";
import { DiaryPage } from "./pages/DiaryPage";

export default function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<OverviewPage />} />
        <Route path="/capture" element={<QuickCapturePage />} />
        <Route path="/diary" element={<DiaryPage />} />
        <Route path="/plants" element={<PlantsPage />} />
        <Route path="/plants/:plantId" element={<PlantDetailPage />} />
        <Route path="/images" element={<ImagesPage />} />
        <Route path="/images/:imageId" element={<ImageWorkspacePage />} />
        <Route path="/measurements" element={<MeasurementsPage />} />
        <Route path="/measurements/:measurementId" element={<MeasurementDetailPage />} />
        <Route path="/analysis" element={<AnalysisPage />} />
        <Route path="/validation" element={<ValidationPage />} />
        <Route path="/experiment" element={<ExperimentPage />} />
        <Route path="/experiment/setup" element={<ExperimentSetupPage />} />
        <Route path="/experiment/daily-log" element={<DailyLabLogPage />} />
        <Route path="/experiment/verification" element={<ExperimentVerificationPage />} />
        <Route path="/experiment/protocol" element={<ProtocolPage />} />
        <Route path="/experiment/water" element={<WaterPage />} />
        <Route path="/experiment/positions" element={<PositionsPage />} />
        <Route path="/experiment/quality" element={<QualityControlPage />} />
        <Route path="/experiment/day0" element={<Day0DashboardPage />} />
        <Route path="/experiment/day0/equipment" element={<Day0EquipmentPage />} />
        <Route path="/experiment/day0/physical-config" element={<Day0PhysicalConfigPage />} />
        <Route path="/experiment/day0/pot-allocation" element={<Day0PotAllocationPage />} />
        <Route path="/experiment/day0/methodology-decisions" element={<Day0MethodologyPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  );
}
