import asyncio
import aiohttp
import argparse
from aiohttp_socks import ProxyConnector, ProxyError, ProxyConnectionError, ProxyTimeoutError
from colorama import init, Fore, Style
from tqdm.asyncio import tqdm
import sys
import os

# Initialize colorama
init(autoreset=True)

# Constants
DEFAULT_TIMEOUT = 10  # Seconds
# List of judge URLs to test against. 
# We use a mix of strict (Google) and lenient/simple sites to ensure we catch working proxies even if Google blocks them.
JUDGE_URLS = [
    "http://www.google.com",
    "http://www.bing.com",
    "http://www.example.com",
    "http://httpbin.org/ip",
    "http://azenv.net/",
    "http://detectportal.firefox.com/success.txt",
]
INPUT_FILE = "new_proxies.txt"
OUTPUT_FILE = "working_proxies.txt"

async def check_proxy(proxy, session, timeout, semaphore):
    """
    Checks a single proxy against multiple judges.
    Returns the proxy string if valid (works on at least one judge), None otherwise.
    """
    async with semaphore:
        proxy_url = f"http://{proxy}"
        for judge in JUDGE_URLS:
            try:
                async with session.get(judge, proxy=proxy_url, timeout=timeout, allow_redirects=False) as response:
                    if response.status == 200:
                        return proxy
            except (aiohttp.ClientError, asyncio.TimeoutError, ProxyError, ProxyConnectionError, ProxyTimeoutError):
                continue
            except Exception:
                continue
        return None

async def main():
    print(f"{Fore.CYAN}Starting Proxy Tester...{Style.RESET_ALL}")
    
    if not os.path.exists(INPUT_FILE):
        print(f"{Fore.RED}Error: {INPUT_FILE} not found.{Style.RESET_ALL}")
        return

    with open(INPUT_FILE, "r") as f:
        proxies = [line.strip() for line in f if line.strip()]

    if not proxies:
        print(f"{Fore.RED}No proxies found in {INPUT_FILE}.{Style.RESET_ALL}")
        return

    print(f"{Fore.YELLOW}Loaded {len(proxies)} proxies.{Style.RESET_ALL}")

    # Limit concurrency to avoid opening too many files/sockets
    semaphore = asyncio.Semaphore(500) 
    timeout = aiohttp.ClientTimeout(total=DEFAULT_TIMEOUT)
    
    working_proxies = []

    async with aiohttp.ClientSession(timeout=timeout) as session:
        tasks = [check_proxy(proxy, session, timeout, semaphore) for proxy in proxies]
        
        # Use tqdm for progress bar
        for f in tqdm.as_completed(tasks, total=len(tasks), desc="Checking Proxies", unit="proxy"):
            result = await f
            if result:
                working_proxies.append(result)

    print(f"\n{Fore.GREEN}Testing Complete!{Style.RESET_ALL}")
    print(f"{Fore.GREEN}Working Proxies: {len(working_proxies)} / {len(proxies)}{Style.RESET_ALL}")

    with open(OUTPUT_FILE, "w") as f:
        for proxy in working_proxies:
            f.write(proxy + "\n")

    print(f"{Fore.CYAN}Saved working proxies to {OUTPUT_FILE}{Style.RESET_ALL}")

if __name__ == "__main__":
    # Windows specific event loop policy to avoid some issues
    if sys.platform == 'win32':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
        
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print(f"\n{Fore.RED}Interrupted by user.{Style.RESET_ALL}")
