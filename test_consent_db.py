"""Quick test to check consent documents in DB."""
import asyncio
from sqlalchemy import select, text
from app.database import AsyncSessionLocal
from app.models.consent import ConsentDocument, UserConsent, UserConsentLog


async def main():
    async with AsyncSessionLocal() as session:
        # Check consent documents
        result = await session.execute(select(ConsentDocument))
        docs = result.scalars().all()
        print(f"ConsentDocuments ({len(docs)}):")
        for doc in docs:
            print(f"  - {doc.type}: v{doc.version}, url={doc.url}")
        
        # Check user consents
        result = await session.execute(select(UserConsent))
        consents = result.scalars().all()
        print(f"\nUserConsents ({len(consents)}):")
        for c in consents:
            print(f"  - user_id={c.user_id}, type={c.type}, accepted={c.accepted}")
        
        # Check logs
        result = await session.execute(select(UserConsentLog))
        logs = result.scalars().all()
        print(f"\nUserConsentLogs ({len(logs)}):")
        for log in logs:
            print(f"  - user_id={log.user_id}, type={log.type}, action={log.action}")


if __name__ == "__main__":
    asyncio.run(main())
