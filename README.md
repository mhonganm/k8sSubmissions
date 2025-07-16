# k8sSubmissions

## Exercises

### Chapter 4

- [3.1.](https://github.com/mhonganm/k8sSubmissions/releases/tag/3.1)
- [3.2.](https://github.com/mhonganm/k8sSubmissions/releases/tag/3.2)
- [3.3.](https://github.com/mhonganm/k8sSubmissions/releases/tag/3.3)
- [3.4.](https://github.com/mhonganm/k8sSubmissions/releases/tag/3.4)
- [3.5.](https://github.com/mhonganm/k8sSubmissions/releases/tag/3.5)
- [3.6.](https://github.com/mhonganm/k8sSubmissions/releases/tag/3.6)
- [3.7.](https://github.com/mhonganm/k8sSubmissions/releases/tag/3.7)
- [3.8.](https://github.com/mhonganm/k8sSubmissions/releases/tag/3.8)
- [3.9.](https://github.com/mhonganm/k8sSubmissions/releases/tag/3.9)

### Chapter 3

- [2.1.](https://github.com/mhonganm/k8sSubmissions/releases/tag/2.1)
- [2.2.](https://github.com/mhonganm/k8sSubmissions/releases/tag/2.2)
- [2.3.](https://github.com/mhonganm/k8sSubmissions/releases/tag/2.3)
- [2.4.](https://github.com/mhonganm/k8sSubmissions/releases/tag/2.4)
- [2.5.](https://github.com/mhonganm/k8sSubmissions/releases/tag/2.5)
- [2.6.](https://github.com/mhonganm/k8sSubmissions/releases/tag/2.6)
- [2.7.](https://github.com/mhonganm/k8sSubmissions/releases/tag/2.7)
- [2.8.](https://github.com/mhonganm/k8sSubmissions/releases/tag/2.8)
- [2.9.](https://github.com/mhonganm/k8sSubmissions/releases/tag/2.9)
- [2.10.](https://github.com/mhonganm/k8sSubmissions/releases/tag/2.10)

### Chapter 2

- [1.1.](https://github.com/mhonganm/k8sSubmissions/releases/tag/1.1)
- [1.2.](https://github.com/mhonganm/k8sSubmissions/releases/tag/1.2)
- [1.3.](https://github.com/mhonganm/k8sSubmissions/releases/tag/1.3)
- [1.4.](https://github.com/mhonganm/k8sSubmissions/releases/tag/1.4)
- [1.5.](https://github.com/mhonganm/k8sSubmissions/releases/tag/1.5)
- [1.6.](https://github.com/mhonganm/k8sSubmissions/releases/tag/1.6)
- [1.7.](https://github.com/mhonganm/k8sSubmissions/releases/tag/1.7)
- [1.8.](https://github.com/mhonganm/k8sSubmissions/releases/tag/1.8)
- [1.9.](https://github.com/mhonganm/k8sSubmissions/releases/tag/1.9)
- [1.10.](https://github.com/mhonganm/k8sSubmissions/releases/tag/1.10)
- [1.11.](https://github.com/mhonganm/k8sSubmissions/releases/tag/1.11)
- [1.12.](https://github.com/mhonganm/k8sSubmissions/releases/tag/1.12)
- [1.13.](https://github.com/mhonganm/k8sSubmissions/releases/tag/1.13)


# Database Solutions: Cloud SQL vs. Self-Managed PostgreSQL on GKE

Choosing between a managed database service (DBaaS) like Google Cloud SQL and a self-managed PostgreSQL instance on Google Kubernetes Engine (GKE) involves trade-offs in control, cost, and operational overhead.

## Option 1: Google Cloud SQL (DBaaS)

### Pros:
* **Managed Service:** Google handles patching, backups, scaling, replication, and high availability.
* **Reduced Operational Overhead:** Significantly less work for initialization, maintenance, and day-to-day operations.
* **Built-in Backup & Restore:** Automated, easy-to-use backups and point-in-time recovery.
* **Scalability:** Easier to scale compute and storage independently with simple configuration changes.
* **High Availability:** Often includes automatic failover and replication.
* **Security:** Benefits from Google Cloud's robust security, IAM, and encryption.

### Cons:
* **Higher Direct Cost:** Generally more expensive than self-managed for comparable resources.
* **Less Control:** Limited access for deep customization or specific performance tuning.
* **Vendor Lock-in:** Tighter integration with Google Cloud.
* **Network Latency (Internal):** Potentially negligible higher latency compared to intra-cluster.

---

## Option 2: Self-Managed PostgreSQL on GKE (with PersistentVolumes)

### Pros:
* **Full Control:** Complete control over the database, OS, and configurations for deep customization.
* **Potentially Lower Direct Cost:** Can be cheaper for raw infrastructure if managed efficiently.
* **Customization:** Ideal for highly specialized use cases or unique operational procedures.
* **Data Locality:** Database pods run within your GKE cluster, potentially offering slightly lower latency.

### Cons:
* **High Operational Overhead:**
    * **Initialization:** Requires manual setup of StatefulSets, PVCs, init scripts, and custom images.
    * **Maintenance:** You are responsible for all aspects: patching, upgrades, monitoring, performance, security.
* **Complex Backup & Restore:** Requires implementing and managing your own backup strategy (e.g., `pg_dump`, WAL archiving) and restoration.
* **Complex High Availability:** Significant effort to implement robust HA (e.g., replication, failover mechanisms).
* **Scalability Challenges:** More complex to scale read replicas or implement sharding.
* **Debugging Complexity:** More components to manage, leading to more complex troubleshooting.

---

## Conclusion

* **For most applications prioritizing rapid development, reliability, and reduced operational burden, Google Cloud SQL (DBaaS) is often the preferred choice.** The higher direct cost is typically offset by significant savings in engineering time and reduced risk.
* **Self-managed PostgreSQL on GKE is suitable for organizations with specific niche requirements, deep database expertise, or extreme cost optimization goals for large-scale deployments where the operational overhead is justified.** It offers maximum control but demands significant investment in setup, maintenance, and expertise.
