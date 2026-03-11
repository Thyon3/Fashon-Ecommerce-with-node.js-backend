import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../services/search_service.dart';

class SearchWidget extends ConsumerStatefulWidget {
  const SearchWidget({
    Key? key,
    this.onProductSelected,
    this.hintText = 'Search products...',
    this.showFilters = true,
  }) : super(key: key);

  final Function(Map<String, dynamic>)? onProductSelected;
  final String hintText;
  final bool showFilters;

  @override
  ConsumerState<SearchWidget> createState() => _SearchWidgetState();
}

class _SearchWidgetState extends ConsumerState<SearchWidget> {
  final TextEditingController _searchController = TextEditingController();
  final FocusNode _searchFocusNode = FocusNode();
  List<String> _suggestions = [];
  List<Map<String, dynamic>> _recentSearches = [];
  bool _isLoading = false;
  bool _showSuggestions = false;

  @override
  void initState() {
    super.initState();
    _loadRecentSearches();
    _searchController.addListener(_onSearchChanged);
  }

  @override
  void dispose() {
    _searchController.removeListener(_onSearchChanged);
    _searchController.dispose();
    _searchFocusNode.dispose();
    super.dispose();
  }

  void _onSearchChanged() {
    final query = _searchController.text;
    
    if (query.isEmpty) {
      setState(() {
        _suggestions.clear();
        _showSuggestions = false;
      });
      return;
    }

    // Get suggestions with debounce
    final searchService = ref.read(searchServiceProvider);
    searchService.debouncedSearch(query, (suggestions) {
      if (mounted) {
        setState(() {
          _suggestions = suggestions['suggestions'] ?? [];
          _showSuggestions = true;
        });
      }
    });
  }

  Future<void> _loadRecentSearches() async {
    final searchService = ref.read(searchServiceProvider);
    final recent = await searchService.getSearchHistory();
    setState(() {
      _recentSearches = recent.map((query) => {'query': query}).toList();
    });
  }

  Future<void> _performSearch(String query) async {
    if (query.trim().isEmpty) return;
    
    setState(() => _isLoading = true);
    _showSuggestions = false;
    _searchFocusNode.unfocus();
    
    try {
      final searchService = ref.read(searchServiceProvider);
      final results = await searchService.searchProducts(query);
      
      if (widget.onProductSelected != null) {
        // Handle search results
        setState(() => _isLoading = false);
      }
    } catch (e) {
      setState(() => _isLoading = false);
      // Show error
    }
  }

  void _selectSuggestion(String suggestion) {
    _searchController.text = suggestion;
    _showSuggestions = false;
    _performSearch(suggestion);
  }

  void _clearSearch() {
    _searchController.clear();
    setState(() {
      _suggestions.clear();
      _showSuggestions = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        // Search input
        Container(
          decoration: BoxDecoration(
            color: Theme.of(context).colorScheme.surface,
            borderRadius: BorderRadius.circular(12),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withOpacity(0.1),
                blurRadius: 4,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: TextField(
            controller: _searchController,
            focusNode: _searchFocusNode,
            decoration: InputDecoration(
              hintText: widget.hintText,
              prefixIcon: const Icon(Icons.search),
              suffixIcon: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (_isLoading)
                    const Padding(
                      padding: EdgeInsets.all(12),
                      child: SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      ),
                    )
                  else
                    IconButton(
                      icon: const Icon(Icons.clear),
                      onPressed: _clearSearch,
                    ),
                  if (widget.showFilters)
                    IconButton(
                      icon: const Icon(Icons.tune),
                      onPressed: _showFilterDialog,
                    ),
                ],
              ),
              border: InputBorder.none,
              contentPadding: const EdgeInsets.symmetric(
                horizontal: 16,
                vertical: 12,
              ),
            ),
            onSubmitted: _performSearch,
            onTap: () {
              setState(() => _showSuggestions = true);
            },
          ),
        ),
        
        // Suggestions dropdown
        if (_showSuggestions && (_suggestions.isNotEmpty || _recentSearches.isNotEmpty))
          Container(
            margin: const EdgeInsets.only(top: 8),
            decoration: BoxDecoration(
              color: Theme.of(context).colorScheme.surface,
              borderRadius: BorderRadius.circular(12),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withOpacity(0.1),
                  blurRadius: 4,
                  offset: const Offset(0, 2),
                ),
              ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (_suggestions.isNotEmpty) ...[
                  Padding(
                    padding: const EdgeInsets.all(12),
                    child: Text(
                      'Suggestions',
                      style: Theme.of(context).textTheme.titleSmall,
                    ),
                  ),
                  ..._suggestions.map((suggestion) => ListTile(
                    dense: true,
                    leading: const Icon(Icons.search, size: 20),
                    title: Text(suggestion),
                    onTap: () => _selectSuggestion(suggestion),
                  )),
                  const Divider(),
                ],
                if (_recentSearches.isNotEmpty) ...[
                  Padding(
                    padding: const EdgeInsets.all(12),
                    child: Text(
                      'Recent Searches',
                      style: Theme.of(context).textTheme.titleSmall,
                    ),
                  ),
                  ..._recentSearches.take(5).map((search) => ListTile(
                    dense: true,
                    leading: const Icon(Icons.history, size: 20),
                    title: Text(search['query']),
                    onTap: () => _selectSuggestion(search['query']),
                  )),
                ],
              ],
            ),
          ),
      ],
    );
  }

  void _showFilterDialog() {
    showDialog(
      context: context,
      builder: (context) => SearchFilterDialog(
        onApply: (filters) {
          // Apply filters to search
          _performSearch(_searchController.text);
        },
      ),
    );
  }
}

class SearchFilterDialog extends StatefulWidget {
  final Function(Map<String, dynamic>) onApply;

  const SearchFilterDialog({
    Key? key,
    required this.onApply,
  }) : super(key: key);

  @override
  State<SearchFilterDialog> createState() => _SearchFilterDialogState();
}

class _SearchFilterDialogState extends State<SearchFilterDialog> {
  String? _selectedCategory;
  String? _selectedBrand;
  double? _minPrice;
  double? _maxPrice;
  String? _sortBy = 'relevance';
  String? _sortOrder = 'desc';

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Search Filters'),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Category filter
            Text(
              'Category',
              style: Theme.of(context).textTheme.titleSmall,
            ),
            const SizedBox(height: 8),
            // Category dropdown would go here
            const SizedBox(height: 16),
            
            // Price range
            Text(
              'Price Range',
              style: Theme.of(context).textTheme.titleSmall,
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                Expanded(
                  child: TextField(
                    decoration: const InputDecoration(
                      labelText: 'Min',
                      prefixText: '\$',
                    ),
                    keyboardType: TextInputType.number,
                    onChanged: (value) {
                      _minPrice = double.tryParse(value);
                    },
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: TextField(
                    decoration: const InputDecoration(
                      labelText: 'Max',
                      prefixText: '\$',
                    ),
                    keyboardType: TextInputType.number,
                    onChanged: (value) {
                      _maxPrice = double.tryParse(value);
                    },
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            
            // Sort options
            Text(
              'Sort By',
              style: Theme.of(context).textTheme.titleSmall,
            ),
            const SizedBox(height: 8),
            // Sort dropdown would go here
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: const Text('Cancel'),
        ),
        ElevatedButton(
          onPressed: () {
            final filters = <String, dynamic>{
              'category': _selectedCategory,
              'brand': _selectedBrand,
              'minPrice': _minPrice,
              'maxPrice': _maxPrice,
              'sortBy': _sortBy,
              'sortOrder': _sortOrder,
            };
            widget.onApply(filters);
            Navigator.of(context).pop();
          },
          child: const Text('Apply'),
        ),
      ],
    );
  }
}
