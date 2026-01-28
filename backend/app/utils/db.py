from flask import current_app


def get_supabase():
    return current_app.supabase
