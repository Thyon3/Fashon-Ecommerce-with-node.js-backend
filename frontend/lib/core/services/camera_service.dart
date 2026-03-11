import 'dart:io';
import 'package:image_picker/image_picker.dart';
import 'package:flutter_image_compress/flutter_image_compress.dart';
import 'package:path_provider/path_provider.dart';

class CameraService {
  static final CameraService _instance = CameraService._internal();
  factory CameraService() => _instance;
  CameraService._internal();

  final ImagePicker _picker = ImagePicker();

  Future<File?> capturePhoto({
    double? maxWidth,
    double? maxHeight,
    int quality = 85,
  }) async {
    try {
      final XFile? image = await _picker.pickImage(
        source: ImageSource.camera,
        maxWidth: maxWidth,
        maxHeight: maxHeight,
        imageQuality: quality,
      );

      if (image != null) {
        return File(image.path);
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  Future<File?> pickPhotoFromGallery({
    double? maxWidth,
    double? maxHeight,
    int quality = 85,
  }) async {
    try {
      final XFile? image = await _picker.pickImage(
        source: ImageSource.gallery,
        maxWidth: maxWidth,
        maxHeight: maxHeight,
        imageQuality: quality,
      );

      if (image != null) {
        return File(image.path);
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  Future<File?> pickVideoFromGallery() async {
    try {
      final XFile? video = await _picker.pickVideo(source: ImageSource.gallery);
      if (video != null) {
        return File(video.path);
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  Future<File?> recordVideo({
    Duration? maxDuration,
  }) async {
    try {
      final XFile? video = await _picker.pickVideo(
        source: ImageSource.camera,
        maxDuration: maxDuration,
      );
      if (video != null) {
        return File(video.path);
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  Future<File?> compressImage(
    File sourceFile, {
    int quality = 85,
    double? maxWidth,
    double? maxHeight,
  }) async {
    try {
      final result = await FlutterImageCompress.compressAndGetFile(
        sourceFile.absolute.path,
        '${sourceFile.parent.path}/compressed_${DateTime.now().millisecondsSinceEpoch}.jpg',
        quality: quality,
        minWidth: maxWidth?.toInt(),
        minHeight: maxHeight?.toInt(),
      );

      if (result != null) {
        return File(result.path);
      }
      return null;
    } catch (e) {
      return sourceFile; // Return original if compression fails
    }
  }

  Future<File?> resizeImage(
    File sourceFile, {
    int? width,
    int? height,
    bool maintainAspectRatio = true,
  }) async {
    try {
      final result = await FlutterImageCompress.compressAndGetFile(
        sourceFile.absolute.path,
        '${sourceFile.parent.path}/resized_${DateTime.now().millisecondsSinceEpoch}.jpg',
        minWidth: width,
        minHeight: height,
        maintainAspectRatio: maintainAspectRatio,
      );

      if (result != null) {
        return File(result.path);
      }
      return null;
    } catch (e) {
      return sourceFile; // Return original if resize fails
    }
  }

  Future<List<File>?> pickMultipleImages({
    double? maxWidth,
    double? maxHeight,
    int quality = 85,
  }) async {
    try {
      final List<XFile> images = await _picker.pickMultiImage(
        maxWidth: maxWidth,
        maxHeight: maxHeight,
        imageQuality: quality,
      );

      return images.map((image) => File(image.path)).toList();
    } catch (e) {
      return null;
    }
  }

  Future<String?> saveImageToAppDirectory(File imageFile, {String? fileName}) async {
    try {
      final directory = await getApplicationDocumentsDirectory();
      final imagesDir = Directory('${directory.path}/images');
      
      if (!await imagesDir.exists()) {
        await imagesDir.create(recursive: true);
      }

      final String finalFileName = fileName ?? 
          'image_${DateTime.now().millisecondsSinceEpoch}.jpg';
      final String newPath = '${imagesDir.path}/$finalFileName';
      
      final savedFile = await imageFile.copy(newPath);
      return savedFile.path;
    } catch (e) {
      return null;
    }
  }

  Future<bool> deleteImage(String imagePath) async {
    try {
      final file = File(imagePath);
      if (await file.exists()) {
        await file.delete();
        return true;
      }
      return false;
    } catch (e) {
      return false;
    }
  }

  Future<int> getImageSize(File imageFile) async {
    try {
      final bytes = await imageFile.length();
      return bytes;
    } catch (e) {
      return 0;
    }
  }

  Future<String?> getImageBase64(File imageFile) async {
    try {
      final bytes = await imageFile.readAsBytes();
      return 'data:image/jpeg;base64,${base64Encode(bytes)}';
    } catch (e) {
      return null;
    }
  }

  String formatFileSize(int bytes) {
    if (bytes < 1024) {
      return '$bytes B';
    } else if (bytes < 1024 * 1024) {
      return '${(bytes / 1024).toStringAsFixed(1)} KB';
    } else if (bytes < 1024 * 1024 * 1024) {
      return '${(bytes / (1024 * 1024)).toStringAsFixed(1)} MB';
    } else {
      return '${(bytes / (1024 * 1024 * 1024)).toStringAsFixed(1)} GB';
    }
  }

  Future<bool> isImageFile(String filePath) async {
    try {
      final file = File(filePath);
      if (!await file.exists()) return false;
      
      final extension = filePath.toLowerCase().split('.').last;
      return ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].contains(extension);
    } catch (e) {
      return false;
    }
  }

  Future<List<String>> getSavedImages() async {
    try {
      final directory = await getApplicationDocumentsDirectory();
      final imagesDir = Directory('${directory.path}/images');
      
      if (!await imagesDir.exists()) {
        return [];
      }

      final files = await imagesDir.list().toList();
      return files
          .where((file) => file is File && file.path.toLowerCase().endsWith('.jpg'))
          .map((file) => file.path)
          .toList();
    } catch (e) {
      return [];
    }
  }
}

// Import base64Encode
import 'dart:convert';
