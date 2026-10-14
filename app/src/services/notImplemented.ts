function notImplemented(name: string): never {
  throw new Error(`${name}: NOT IMPLEMENTED`);
}

export class NotImplementedPlantService {
  async listPlants() {
    return notImplemented("PlantService.listPlants");
  }

  async getPlantById(_plantId: string) {
    return notImplemented("PlantService.getPlantById");
  }

  async getDayContext(_plantId: string) {
    return notImplemented("PlantService.getDayContext");
  }
}

export class NotImplementedImageService {
  async listImages() {
    return notImplemented("ImageService.listImages");
  }

  async getImageById(_imageId: string) {
    return notImplemented("ImageService.getImageById");
  }
}

export class NotImplementedMeasurementService {
  async listManualMeasurements() {
    return notImplemented("MeasurementService.listManualMeasurements");
  }

  async listAICVMeasurements() {
    return notImplemented("MeasurementService.listAICVMeasurements");
  }
}

export class NotImplementedValidationService {
  async listValidationIssues() {
    return notImplemented("ValidationService.listValidationIssues");
  }
}

export class NotImplementedCalibrationService {
  async getCalibrationStatusByImageId(_imageId: string) {
    return notImplemented("CalibrationService.getCalibrationStatusByImageId");
  }
}

export class NotImplementedAIService {
  async getModelConfiguration() {
    return notImplemented("AIService.getModelConfiguration");
  }
}

export class NotImplementedWaterService {
  async listWaterEvents() {
    return notImplemented("WaterService.listWaterEvents");
  }
}
