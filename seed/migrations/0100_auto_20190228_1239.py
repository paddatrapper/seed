# -*- coding: utf-8 -*-
# Generated by Django 1.11.20 on 2019-02-28 20:39
from __future__ import unicode_literals

import json
import re
import string

import django.contrib.gis.db.models.fields
from django.db import migrations, models


def _snake_case(display_name):
    """
    Convert the BuildingSync measure display names into reasonable snake_case for storing into
    database.

    :param display_name: BuidingSync measure displayname
    :return: string
    """
    str_re = re.compile('[{0}]'.format(re.escape(string.punctuation)))
    str = str_re.sub(' ', display_name)
    str = re.sub('(.)([A-Z][a-z]+)', r'\1_\2', str)
    str = re.sub('([a-z0-9])([A-Z])', r'\1_\2', str).lower()
    return re.sub(' +', '_', str)


def populate_measures(apps, organization_id, schema_type='BuildingSync', schema_version="1.0.0"):
    """
    Populate the list of measures from the BuildingSync
    Default is BuildingSync 1.0.0

    :param organization_id: integer, ID of the organization to populate measures
    :return:
    """
    filename = "seed/building_sync/lib/enumerations.json"
    with open(filename) as f:
        data = json.load(f)

        Measure = apps.get_model("seed", "Measure")

        for datum in data:
            # "name": "MeasureName",
            # "sub_name": "AdvancedMeteringSystems",
            # "documentation": "Advanced Metering Systems",
            # "enumerations": [
            #                     "Install advanced metering systems",
            #                     "Clean and/or repair",
            #                     "Implement training and/or documentation",
            #                     "Upgrade operating protocols, calibration, and/or sequencing",
            #                     "Other"
            #                 ],
            if datum["name"] == "MeasureName":
                for enum in datum["enumerations"]:
                    Measure.objects.get_or_create(
                        organization_id=organization_id,
                        category=_snake_case(datum["sub_name"]),
                        category_display_name=datum["documentation"],
                        name=_snake_case(enum),
                        display_name=enum,
                        schema_type=schema_type,
                        schema_version=schema_version
                    )


def forwards(apps, schema_editor):
    # process the measures table with changes from BuildingSync v1.0.0
    Organization = apps.get_model("orgs", "Organization")

    # find all organizations
    for c in Organization.objects.all():
        print("Org: {}, Name: {}".format(c.name, c.id))

        # call populate_measures
        populate_measures(apps, c.id)

    # Now add the new ULID object to all the organizations
    Column = apps.get_model("seed", "Column")
    Organization = apps.get_model("orgs", "Organization")

    new_db_fields = [
        {
            'column_name': 'ulid',
            'table_name': 'PropertyState',
            'display_name': 'ULID',
            'data_type': 'string',
        }
    ]

    # Go through all the organizatoins
    for org in Organization.objects.all():
        for new_db_field in new_db_fields:
            columns = Column.objects.filter(
                organization_id=org.id,
                table_name=new_db_field['table_name'],
                column_name=new_db_field['column_name'],
                is_extra_data=False,
            )

            if not columns.count():
                new_db_field['organization_id'] = org.id
                Column.objects.create(**new_db_field)
            elif columns.count() == 1:
                # If the column exists, then just update the display_name and data_type if empty
                c = columns.first()
                if c.display_name is None or c.display_name == '':
                    c.display_name = new_db_field['display_name']
                if c.data_type is None or c.data_type == '' or c.data_type == 'None':
                    c.data_type = new_db_field['data_type']
                c.save()
            else:
                print("  More than one column returned")


class Migration(migrations.Migration):
    dependencies = [
        ('seed', '0099_auto_20190214_1259'),
    ]

    operations = [
        migrations.AddField(
            model_name='measure',
            name='schema_type',
            field=models.CharField(default='BuildingSync', max_length=255),
        ),
        migrations.AddField(
            model_name='measure',
            name='schema_version',
            field=models.CharField(default='1.0.0', max_length=15),
        ),
        migrations.AddField(
            model_name='propertystate',
            name='property_footprint',
            field=django.contrib.gis.db.models.fields.PolygonField(blank=True, geography=True,
                                                                   null=True, srid=4326),
        ),
        migrations.AddField(
            model_name='taxlotstate',
            name='taxlot_footprint',
            field=django.contrib.gis.db.models.fields.PolygonField(blank=True, geography=True,
                                                                   null=True, srid=4326),
        ),
        migrations.AddField(
            model_name='taxlotstate',
            name='ulid',
            field=models.CharField(blank=True, max_length=255, null=True),
        ),
        migrations.RunPython(forwards),
        migrations.RunSQL('DROP TABLE IF EXISTS celery_taskmeta;'),
        migrations.RunSQL('DROP TABLE IF EXISTS celery_tasksetmeta;'),
        migrations.RunSQL('DROP TABLE IF EXISTS djcelery_crontabschedule CASCADE;'),
        migrations.RunSQL('DROP TABLE IF EXISTS djcelery_intervalschedule CASCADE;'),
        migrations.RunSQL('DROP TABLE IF EXISTS djcelery_periodictask;'),
        migrations.RunSQL('DROP TABLE IF EXISTS djcelery_periodictasks;'),
        migrations.RunSQL('DROP TABLE IF EXISTS djcelery_taskstate;'),
        migrations.RunSQL('DROP TABLE IF EXISTS djcelery_workerstate;'),
        migrations.RunSQL('DROP TABLE IF EXISTS organizations_organization CASCADE;'),
        migrations.RunSQL('DROP TABLE IF EXISTS organizations_organizationowner;'),
        migrations.RunSQL('DROP TABLE IF EXISTS organizations_organizationuser;'),
        migrations.RunSQL('DROP TABLE IF EXISTS south_migrationhistory;'),
        migrations.RunSQL('DROP TABLE IF EXISTS tos_termsofservice CASCADE;'),
        migrations.RunSQL('DROP TABLE IF EXISTS tos_useragreement;'),
    ]
