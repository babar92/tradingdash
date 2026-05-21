_registry = {}

def register_source(name):
    def decorator(cls_or_instance):
        _registry[name] = cls_or_instance() if isinstance(cls_or_instance, type) else cls_or_instance
        return cls_or_instance
    return decorator

def get_source(name):
    if name not in _registry:
        raise KeyError(f"Data source '{name}' not registered. Available: {list(_registry.keys())}")
    return _registry[name]

def list_sources():
    return list(_registry.keys())
