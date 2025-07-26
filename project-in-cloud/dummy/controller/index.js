const k8s = require('@kubernetes/client-node');
const fetch = require('node-fetch');

const kc = new k8s.KubeConfig();
kc.loadFromDefault();

const k8sApi = kc.makeApiClient(k8s.CoreV1Api);
const k8sAppsApi = kc.makeApiClient(k8s.AppsV1Api);
const k8sNetworkingApi = kc.makeApiClient(k8s.NetworkingV1Api);
const k8sCustomObjectsApi = kc.makeApiClient(k8s.CustomObjectsApi);

const updateDummySiteStatus = async (name, namespace, phase, message, url = '') => {
    const status = {
        status: {
            phase: phase,
            message: message,
            url: url,
        },
    };
    await k8sCustomObjectsApi.patchNamespacedCustomObjectStatus(group, version, namespace, plural, name, status, undefined, undefined, undefined, { headers: { 'Content-Type': 'application/merge-patch+json' } });
};

const group = 'stable.dwk';
const version = 'v1';
const plural = 'dummysites';
const finalizerName = 'stable.dwk/finalizer';

const createOrUpdateResources = async (obj) => {
    const name = obj.metadata.name;
    const namespace = obj.metadata.namespace;
    const url = obj.spec.website_url;

    console.log(`Processing DummySite '${name}' in namespace '${namespace}' for URL: ${url}`);

    // 1. Fetch website content
    let htmlContent;
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch URL: ${response.statusText}`);
        }
        htmlContent = await response.text();
        console.log(`Successfully fetched content from ${url}. Length: ${htmlContent.length}`);
    } catch (err) {
        console.error(`Error fetching URL ${url}:`, err.message);        
        await updateDummySiteStatus(name, namespace, 'Failed', `Error fetching URL: ${err.message}`);
        return;
    }

    const resourceName = `dummysite-${name}`;
    const labels = { app: resourceName, managedBy: 'dummysite-controller' };

    // 2. Create a ConfigMap with the HTML content
    const configMap = {
        apiVersion: 'v1',
        kind: 'ConfigMap',
        metadata: { name: resourceName, namespace, labels },
        data: { 'index.html': htmlContent },
    };

    // 3. Create a Deployment for an Nginx server
    const deployment = {
        apiVersion: 'apps/v1',
        kind: 'Deployment',
        metadata: { name: resourceName, namespace, labels },
        spec: {
            replicas: 1,
            selector: { matchLabels: labels },
            template: {
                metadata: { labels },
                spec: {
                    containers: [{
                        name: 'nginx',
                        image: 'nginx:alpine',
                        ports: [{ containerPort: 80 }],
                        volumeMounts: [{ name: 'html-volume', mountPath: '/usr/share/nginx/html' }],
                        readinessProbe: {
                          httpGet: {
                            path: '/',
                            port: 80,
                          },
                          initialDelaySeconds: 5,
                          periodSeconds: 10,
                        },
                    }],
                    volumes: [{ name: 'html-volume', configMap: { name: resourceName } }],
                },
            },
        },
    };

    // 4. Create a Service to expose the Deployment
    const service = {
        apiVersion: 'v1',
        kind: 'Service',
        metadata: {
            name: resourceName,
            namespace,
            labels,
            annotations: { 'cloud.google.com/neg': '{"ingress": true}' }
        },
        spec: {
            selector: labels,
            ports: [{ protocol: 'TCP', port: 80, targetPort: 80 }],
            type: 'ClusterIP',
        },
    };

    // 5. Create an Ingress to expose the Service
    const ingressHost = `${name}.dummysite.io`;
    const ingress = {
        apiVersion: 'networking.k8s.io/v1',
        kind: 'Ingress',
        metadata: {
            name: resourceName,
            namespace,
            labels,
            // The rewrite-target annotation is for the community NGINX ingress controller, not GKE's default.
            // We remove it as it has no effect and can be misleading.
        },
        spec: {
            rules: [{
                host: ingressHost,
                http: {
                    paths: [{
                        path: `/`,
                        pathType: 'Prefix',
                        backend: { service: { name: resourceName, port: { number: 80 } } },
                    }],
                },
            }],
        },
    };

    // Apply all resources
    try {
        console.log(`Applying ConfigMap: ${resourceName}`);
        await k8sApi.createNamespacedConfigMap(namespace, configMap).catch(async (e) => {
            if (e.body.code === 409) await k8sApi.replaceNamespacedConfigMap(resourceName, namespace, configMap); else throw e;
        });

        console.log(`Applying Deployment: ${resourceName}`);
        await k8sAppsApi.createNamespacedDeployment(namespace, deployment).catch(async (e) => {
            if (e.body.code === 409) await k8sAppsApi.replaceNamespacedDeployment(resourceName, namespace, deployment); else throw e;
        });

        console.log(`Applying Service: ${resourceName}`);
        await k8sApi.createNamespacedService(namespace, service).catch(async (e) => {
            if (e.body.code === 409) await k8sApi.replaceNamespacedService(resourceName, namespace, service); else throw e;
        });

        console.log(`Applying Ingress: ${resourceName}`);
        await k8sNetworkingApi.createNamespacedIngress(namespace, ingress).catch(async (e) => {
            if (e.body.code === 409) await k8sNetworkingApi.replaceNamespacedIngress(resourceName, namespace, ingress); else throw e;
        });

        await updateDummySiteStatus(name, namespace, 'Deployed', 'All resources created successfully.', `http://${ingressHost}`);
        console.log(`Successfully deployed all resources for DummySite '${name}'`);
    } catch (err) {
        console.error(`Failed to apply resources for DummySite '${name}':`, err.body ? err.body.message : err.message);
        await updateDummySiteStatus(name, namespace, 'Failed', `Error applying resources: ${err.body ? err.body.message : err.message}`, '');
    }
};

const reconcile = async (obj) => {
    const name = obj.metadata.name;
    const namespace = obj.metadata.namespace;

    // Check if the object is being deleted
    if (obj.metadata.deletionTimestamp) {
        console.log(`DummySite '${name}' is being deleted.`);
        const resourceName = `dummysite-${name}`;
        
        // Run cleanup logic
        try {
            await k8sNetworkingApi.deleteNamespacedIngress(resourceName, namespace).catch(e => { if (e.body.code !== 404) throw e; });
            await k8sApi.deleteNamespacedService(resourceName, namespace).catch(e => { if (e.body.code !== 404) throw e; });
            await k8sAppsApi.deleteNamespacedDeployment(resourceName, namespace).catch(e => { if (e.body.code !== 404) throw e; });
            await k8sApi.deleteNamespacedConfigMap(resourceName, namespace).catch(e => { if (e.body.code !== 404) throw e; });
            console.log(`Successfully cleaned up resources for DummySite '${name}'`);

            // Remove the finalizer to allow Kubernetes to complete the deletion
            const finalizers = obj.metadata.finalizers.filter(f => f !== finalizerName);
            const patch = [{ op: 'replace', path: '/metadata/finalizers', value: finalizers }];
            await k8sCustomObjectsApi.patchNamespacedCustomObject(group, version, namespace, plural, name, patch, undefined, undefined, undefined, { headers: { 'Content-Type': 'application/json-patch+json' } });
            console.log(`Removed finalizer from DummySite '${name}'`);
        } catch (err) {
            console.error(`Failed during finalizer cleanup for '${name}':`, err.body ? err.body.message : err.message);
        }
    } else {
        // This is a create or update event
        if (!obj.metadata.finalizers || !obj.metadata.finalizers.includes(finalizerName)) {
            // Add our finalizer if it's not there
            const patch = [{ op: 'add', path: '/metadata/finalizers', value: [finalizerName] }];
            await k8sCustomObjectsApi.patchNamespacedCustomObject(group, version, namespace, plural, name, patch, undefined, undefined, undefined, { headers: { 'Content-Type': 'application/json-patch+json' } });
            console.log(`Added finalizer to DummySite '${name}'`);
        }

        // Run the main resource creation logic
        await createOrUpdateResources(obj);
    }
};

const main = () => {
    // The namespace to watch. 'default' is used here, but this could be configured via environment variables.
    const namespace = process.env.K8S_NAMESPACE || 'default';
    console.log(`Watching for DummySite resources in namespace: ${namespace}`);

    const informer = k8s.makeInformer(kc, `/apis/${group}/${version}/namespaces/${namespace}/${plural}`, () =>
        k8sCustomObjectsApi.listNamespacedCustomObject(group, version, namespace, plural)
    );

    informer.on('add', async (obj) => {
        try {
            await reconcile(obj);
        } catch (err) {
            console.error(`Unhandled error in ADD handler for ${obj.metadata.name}:`, err);
        }
    });
    informer.on('update', async (obj) => {
        try {
            await reconcile(obj);
        } catch (err) {
            console.error(`Unhandled error in UPDATE handler for ${obj.metadata.name}:`, err);
        }
    });

    informer.start();
    console.log('DummySite controller started and watching for resources...');
};

main();