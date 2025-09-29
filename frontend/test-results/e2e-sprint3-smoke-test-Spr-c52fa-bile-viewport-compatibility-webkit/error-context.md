# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e2]:
    - navigation "breadcrumb" [ref=e3]:
      - list [ref=e4]:
        - listitem [ref=e5]:
          - link "Tickets" [ref=e6]:
            - /url: /tickets
        - listitem [ref=e7]:
          - img [ref=e8]
        - listitem [ref=e10]:
          - link "Create New Ticket" [disabled] [ref=e11]
    - generic [ref=e12]:
      - generic [ref=e13]: The ticket form encountered an error. Don't worry - your data has been automatically saved.
      - generic [ref=e14]:
        - button "Restore Form Data" [ref=e15]
        - button "Reload Page" [ref=e16]
      - paragraph [ref=e17]: If the problem persists, please contact support.
  - region "Notifications (F8)":
    - list
  - button "Open Next.js Dev Tools" [ref=e23] [cursor=pointer]:
    - img [ref=e24] [cursor=pointer]
  - alert [ref=e29]
```