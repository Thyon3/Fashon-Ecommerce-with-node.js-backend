import 'package:equatable/equatable.dart';
import 'package:frontend/core/common/entities/user.dart';

class Wishlist extends Equatable {
  const Wishlist({
    required this.productId,
    required this.productImage,
    required this.productName,
    required this.productPrice,
    required this.productExists,
    required this.productOutOfStock,
    this.productDescription,
    this.productCategory,
    this.productRating,
    this.dateAdded,
    this.id,
  });

  final String? id;
  final String productId;
  final String productImage;
  final String productName;
  final double productPrice;
  final bool productExists;
  final bool productOutOfStock;
  final String? productDescription;
  final String? productCategory;
  final double? productRating;
  final DateTime? dateAdded;

  @override
  List<Object?> get props => [
    id,
    productId,
    productImage,
    productName,
    productPrice,
    productExists,
    productOutOfStock,
    productDescription,
    productCategory,
    productRating,
    dateAdded,
  ];

  // Factory constructor for JSON serialization
  factory Wishlist.fromJson(Map<String, dynamic> json) {
    return Wishlist(
      id: json['_id'] as String? ?? json['id'] as String?,
      productId: json['productId'] as String,
      productImage: json['productImage'] as String,
      productName: json['productName'] as String,
      productPrice: (json['productPrice'] as num).toDouble(),
      productExists: json['productExists'] as bool? ?? true,
      productOutOfStock: json['productOutOfStock'] as bool? ?? false,
      productDescription: json['productDescription'] as String?,
      productCategory: json['productCategory'] as String?,
      productRating: json['productRating'] != null 
          ? (json['productRating'] as num).toDouble() 
          : null,
      dateAdded: json['dateAdded'] != null 
          ? DateTime.parse(json['dateAdded'] as String)
          : DateTime.now(),
    );
  }

  // Method to convert to JSON
  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'productId': productId,
      'productImage': productImage,
      'productName': productName,
      'productPrice': productPrice,
      'productExists': productExists,
      'productOutOfStock': productOutOfStock,
      'productDescription': productDescription,
      'productCategory': productCategory,
      'productRating': productRating,
      'dateAdded': dateAdded?.toIso8601String(),
    };
  }

  // Copy with method for immutability
  Wishlist copyWith({
    String? id,
    String? productId,
    String? productImage,
    String? productName,
    double? productPrice,
    bool? productExists,
    bool? productOutOfStock,
    String? productDescription,
    String? productCategory,
    double? productRating,
    DateTime? dateAdded,
  }) {
    return Wishlist(
      id: id ?? this.id,
      productId: productId ?? this.productId,
      productImage: productImage ?? this.productImage,
      productName: productName ?? this.productName,
      productPrice: productPrice ?? this.productPrice,
      productExists: productExists ?? this.productExists,
      productOutOfStock: productOutOfStock ?? this.productOutOfStock,
      productDescription: productDescription ?? this.productDescription,
      productCategory: productCategory ?? this.productCategory,
      productRating: productRating ?? this.productRating,
      dateAdded: dateAdded ?? this.dateAdded,
    );
  }

  // Helper method to check if product is available
  bool get isAvailable => productExists && !productOutOfStock;

  // Helper method to get formatted price
  String get formattedPrice => '\$${productPrice.toStringAsFixed(2)}';

  // Helper method to get truncated description
  String get truncatedDescription {
    if (productDescription == null || productDescription!.isEmpty) {
      return 'No description available';
    }
    return productDescription!.length > 100 
        ? '${productDescription!.substring(0, 100)}...'
        : productDescription!;
  }

  // Empty constructor
  static const Wishlist empty = Wishlist(
    productId: 'test string',
    productImage: 'test string',
    productName: 'test string',
    productExists: false,
    productOutOfStock: true,
    productPrice: 100.0,
  );

  @override
  String toString() => 'Wishlist(id: $id, productId: $productId, productName: $productName, productPrice: $productPrice)';
}
