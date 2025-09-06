# Azure Templates

This directory will contain Microsoft Azure-specific templates for:

- Azure API Management
- Azure Functions or Container Instances
- Azure Application Gateway
- Azure Active Directory and RBAC

## Coming Soon

Azure support is planned but not yet implemented. Currently, only AWS is supported.

## Expected Structure

```
azure/
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

- [Azure API Management](https://azure.microsoft.com/en-us/services/api-management/)
- [Azure Functions](https://azure.microsoft.com/en-us/services/functions/)
- [Terraform Azure Provider](https://registry.terraform.io/providers/hashicorp/azurerm/latest)
