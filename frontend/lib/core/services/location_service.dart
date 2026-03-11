import 'package:geolocator/geolocator.dart';
import 'package:permission_handler/permission_handler.dart';

class LocationService {
  static final LocationService _instance = LocationService._internal();
  factory LocationService() => _instance;
  LocationService._internal();

  Position? _currentPosition;
  bool _isInitialized = false;

  Future<void> init() async {
    try {
      await _checkPermissions();
      _isInitialized = true;
    } catch (e) {
      _isInitialized = false;
    }
  }

  Future<bool> _checkPermissions() async {
    final locationPermission = await Permission.location;
    
    if (locationPermission.isDenied) {
      final result = await Permission.location.request();
      return result.isGranted;
    }
    
    return locationPermission.isGranted;
  }

  Future<Position?> getCurrentPosition() async {
    try {
      final hasPermission = await _checkPermissions();
      if (!hasPermission) return null;

      _currentPosition = await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.high,
        timeLimit: const Duration(seconds: 10),
      );
      
      return _currentPosition;
    } catch (e) {
      return null;
    }
  }

  Future<Position?> getLastKnownPosition() async {
    try {
      return await Geolocator.getLastKnownPosition();
    } catch (e) {
      return null;
    }
  }

  Stream<Position> getPositionStream() {
    return Geolocator.getPositionStream(
      locationSettings: const LocationSettings(
        accuracy: LocationAccuracy.high,
        distanceFilter: 10, // Update every 10 meters
      ),
    );
  }

  Future<double> calculateDistance(
    double startLatitude,
    double startLongitude,
    double endLatitude,
    double endLongitude,
  ) async {
    try {
      return Geolocator.distanceBetween(
        startLatitude,
        startLongitude,
        endLatitude,
        endLongitude,
      );
    } catch (e) {
      return 0.0;
    }
  }

  Future<bool> isLocationServiceEnabled() async {
    try {
      return await Geolocator.isLocationServiceEnabled();
    } catch (e) {
      return false;
    }
  }

  Future<void> openLocationSettings() async {
    try {
      await Geolocator.openLocationSettings();
    } catch (e) {
      // Handle error
    }
  }

  Future<void> openAppSettings() async {
    try {
      await Geolocator.openAppSettings();
    } catch (e) {
      // Handle error
    }
  }

  String formatDistance(double meters) {
    if (meters < 1000) {
      return '${meters.round()}m';
    } else {
      final km = meters / 1000;
      return '${km.toStringAsFixed(1)}km';
    }
  }

  Map<String, dynamic> getLocationInfo(Position position) {
    return {
      'latitude': position.latitude,
      'longitude': position.longitude,
      'accuracy': position.accuracy,
      'altitude': position.altitude,
      'speed': position.speed,
      'timestamp': position.timestamp?.toIso8601String(),
      'heading': position.heading,
    };
  }

  bool get isInitialized => _isInitialized;
  Position? get currentPosition => _currentPosition;
}
