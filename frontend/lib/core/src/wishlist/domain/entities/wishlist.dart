import 'package:equatable/equatable.dart';
import 'package:frontend/core/common/entities/user.dart';

class Wishlist extends Equatable {
  Wishlist({
    required this.productId,
    required this.productImage,
    required this.productName,
    required this.productPrice,
    required this.productExists,
    required this.productOutOfStock,
  });

  final String productId;
  final String productImage;
  final String productName;
  final double productPrice;
  final bool productExists;
  final bool productOutOfStock;

  @override
  // TODO: implement props
  List<Object?> get props => [
    productImage,
    productPrice,
    productId,
    productPrice,
  ];

  Wishlist.empty()
    : productId = 'test string',
      productImage = 'test string',
      productName = 'test string',
      productExists = false,
      productOutOfStock = true,
      productPrice = 100;
}
