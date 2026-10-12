from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("pedidos", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="pedido",
            name="acepta_comunicaciones",
            field=models.BooleanField(
                default=False, verbose_name="acepta recibir comunicaciones"
            ),
        ),
    ]
