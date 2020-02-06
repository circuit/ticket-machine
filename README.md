## Ticketing machine

Actors/components:
- Customer on Booth
    - Web app (booth)
    - Hidden DA (booth, same account)
- Expert
    - Web app (logged in as expert X)

Flow:
1. Customer presses “Ask for help” on booth webapp which sends request to expert asking for help. Request is not part of Circuit SDK.
2. Experts see booth Y is asking for help. One expert is accepting request. 
3. Expert webapp creates group conversation (or uses existing group conversation), starts RTC Session and notifies the booth webapp and booth DA (incl. guest token)
4. Booth DA joins conference and starts screenshare, and remote control (once available)
5. Expert webapp shows feedback and expert can see your screen and is ready to help

