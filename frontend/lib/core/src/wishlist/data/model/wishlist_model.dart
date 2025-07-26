import 'package:frontend/core/src/wishlist/domain/entities/wishlist.dart';

class WishlistModel extends Wishlist {
  WishlistModel({
    required super.productId,
    required super.productImage,
    required super.productName,
    required super.productPrice,
    required super.productExists,
    required super.productOutOfStock,
  });

  @override
  List<Object?> get props => [
    productImage,
    productPrice,
    productId,
    productPrice,
    productExists,
    productOutOfStock,
  ];

  WishlistModel.empty()
    : super(
        productExists: false,
        productId: 'test string',
        productImage: 'test string',
        productName: 'test string',
        productOutOfStock: true,
        productPrice: 90,
      );

  WishlistModel copyWith({
    String? productImage,
    String? productName,
    double? productPrice,
    String? productId,
    bool? productExists,
    bool? productOutOfStock,
  }) {
    return WishlistModel(
      productName: productName ?? this.productName,
      productPrice: productPrice ?? this.productPrice,
      productId: productId ?? this.productId,
      productImage: productImage ?? this.productImage,
      productExists: productExists ?? this.productExists,
      productOutOfStock: productOutOfStock ?? this.productOutOfStock,
    );
  }

  factory WishlistModel.fromMap(Map<String, dynamic> map) {
    return WishlistModel(
      productId: map['productId'] as String,
      productImage: map['productImage'] as String,
      productName: map['productName'] as String,
      productPrice: (map['productPrice'] as num).toDouble(),
      productExists: map['productExists'] as bool,
      productOutOfStock: map['productOutOfStock'] as bool,
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'productId': productId,
      'productImage': productImage,
      'productName': productName,
      'productPrice': productPrice,
      'productExists': productExists,
      'productOutOfStock': productOutOfStock,
    };
  }
}
