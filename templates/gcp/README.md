# GCP Templates

This directory will contain Google Cloud Platform-specific templates for:

- Cloud Endpoints or API Gateway
- Cloud Run or Cloud Functions
- Google Cloud Load Balancer
- IAM and service accounts

## Coming Soon

GCP support is planned but not yet implemented. Currently, only AWS is supported.

## Expected Structure

```
gcp/
├── modules/
│   └── service/
│       ├── main.tf.hbs
│       ├── outputs.tf.hbs
│       └── variables.tf.hbs
└── root/
    ├── main.tf.hbs
    ├── outputs.tf.hbs
    ├── provider.tf.hbs
    └── variables.tf.hbs
```

## Resources

- [Google Cloud Endpoints](https://cloud.google.com/endpoints)
- [Cloud Run](https://cloud.google.com/run)
- [Terraform GCP Provider](https://registry.terraform.io/providers/hashicorp/google/latest)
