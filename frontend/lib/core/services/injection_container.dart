import 'package:frontend/core/common/application/cache_helper.dart';
import 'package:get_it/get_it.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:dio/dio.dart';
import 'package:frontend/core/src/auth/data/repositories/authentication_repostitory_implementation.dart';
import 'package:frontend/core/src/auth/domain/repository/auth_repo.dart';
import 'package:frontend/core/src/auth/domain/usecases/login.dart';
import 'package:frontend/core/src/auth/domain/usecases/register.dart';
import 'package:frontend/core/src/auth/domain/usecases/forgot_password.dart';
import 'package:frontend/core/src/auth/domain/usecases/reset_password.dart';
import 'package:frontend/core/src/auth/domain/usecases/verify_otp.dart';
import 'package:frontend/core/src/auth/domain/usecases/verify_token.dart';

part 'injection_container.main.dart';
