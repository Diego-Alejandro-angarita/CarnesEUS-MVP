from django.db import migrations, models


def forward(apps, schema_editor):
    Usuario = apps.get_model("accounts", "Usuario")
    for usuario in Usuario.objects.filter(last_login__isnull=False):
        usuario.tutoriales_vistos = ["cliente"]
        usuario.save(update_fields=["tutoriales_vistos"])


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="usuario",
            name="tutoriales_vistos",
            field=models.JSONField(
                default=list, blank=True, verbose_name="tutoriales vistos"
            ),
        ),
        migrations.RunPython(forward, migrations.RunPython.noop),
    ]
