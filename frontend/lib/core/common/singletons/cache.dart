class Cache {
  Cache._internal();
  //  creating the only instance of Cache Cache.instance.
  static final Cache instance = Cache._internal();

  String? _sessionToken;
  String? _userId;
  String? _themeModeSelection;

  // getters for the
  String? get getSessionToken => _sessionToken;
  String? get getUserId => _userId;
  String? get getThemeModePreference => _themeModeSelection;

  // setters for the auth tokens

  void setSessionToken(String? token) {
    if (_sessionToken != token) _sessionToken = token;
  }

  void setUserId(String? id) {
    if (_userId != id) _userId = id;
  }

  void setThemeModePreference(String? theme) {
    if (_themeModeSelection != theme) {
      _themeModeSelection = theme;
    }
  }

  // reset the session

  void resetSession() {
    setSessionToken(null);
    setUserId(null);
  }
}
