import argparse
import asyncio

from app.core.admin_bootstrap import create_or_update_admin


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Create or update an admin user.")
    parser.add_argument("--email", required=True, help="Admin email address")
    parser.add_argument("--password", required=True, help="Admin password")
    parser.add_argument("--full-name", default="Platform Admin", help="Display name for the admin account")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    action = asyncio.run(
        create_or_update_admin(
            email=args.email,
            password=args.password,
            full_name=args.full_name,
            reset_password=True,
        )
    )
    print(f"Admin account {action}: {args.email.strip().lower()}")


if __name__ == "__main__":
    main()